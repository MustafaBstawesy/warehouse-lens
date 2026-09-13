import cds from '@sap/cds';
import { seedDemoRequests, IDS } from '../srv/lib/seed-demo';

const capTest = (cds as any).test(__dirname + '/..');
const { POST } = capTest;

const alex = { auth: { username: 'alex', password: '' } };
const dana = { auth: { username: 'dana', password: '' } };
const bob = { auth: { username: 'bob', password: '' } };

const SUBMIT_URL = '/odata/v4/warehouse/submitTransferRequest';

const INACTIVE_WAREHOUSE_ID = 'eeeeeeee-0000-4000-8000-000000000005';

function submitPayload(overrides: Record<string, unknown> = {}) {
  return {
    materialID: IDS.mat1042,
    sourceWarehouseID: IDS.alexandria,
    destinationWarehouseID: IDS.cairo,
    quantity: 20,
    note: 'Line 3 is down, bearings needed urgently.',
    idempotencyKey: `test-key-${Math.random().toString(36).slice(2, 12)}`,
    ...overrides,
  };
}

async function expectError(promise: Promise<unknown>, status: number, code?: string, messagePart?: string) {
  try {
    await promise;
    throw new Error(`expected request to fail with HTTP ${status}, but it succeeded`);
  } catch (e: any) {
    if (!e.response) throw e;
    expect(e.response.status).toBe(status);
    if (code) expect(e.response.data?.error?.code).toBe(code);
    if (messagePart) expect(e.response.data?.error?.message).toContain(messagePart);
  }
}

describe('submitTransferRequest', () => {
  let db: any;
  let TransferRequests: any;
  let RequestEvents: any;
  let Stocks: any;
  let Counters: any;
  let Warehouses: any;


  beforeAll(async () => {
    db = await cds.connect.to('db');
    ({ TransferRequests, RequestEvents, Stocks, Counters, Warehouses } = cds.entities('wl'));
    await seedDemoRequests(db);
    // Extra fixture: an inactive warehouse, not part of the demo seed.
    await db.run(
      cds.ql.INSERT.into(Warehouses).entries({
        ID: INACTIVE_WAREHOUSE_ID,
        code: 'PSD',
        name: 'Port Said (closed)',
        city: 'Port Said',
        active: false,
      })
    );
  });

  test('valid request creates AWAITING_APPROVAL request with reference and SUBMITTED event, atomically', async () => {
    const payload = submitPayload();
    const { status, data } = await POST(SUBMIT_URL, payload, alex);
    expect(status).toBe(200);
    expect(data.reference).toMatch(/^TR-\d{6}$/);
    expect(data.status).toBe('AWAITING_APPROVAL');
    expect(data.quantity).toBe(20);
    expect(data.materialCode).toBe('MAT-1042');
    expect(data.sourceCode).toBe('ALX');
    expect(data.destinationCode).toBe('CAI');
    expect(data.replayed).toBe(false);
    expect(data.createdAt).toBeTruthy();

    // Persisted request + exactly one SUBMITTED event, created together.
    const row = await db.run(cds.ql.SELECT.one.from(TransferRequests).where({ ID: data.ID }));
    expect(row).toBeTruthy();
    expect(row.createdBy).toBe('alex');
    expect(row.status).toBe('AWAITING_APPROVAL');
    const events = await db.run(cds.ql.SELECT.from(RequestEvents).where({ request_ID: data.ID }));
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('SUBMITTED');
    expect(events[0].actor).toBe('alex');
  });

  test('zero quantity is rejected', async () => {
    await expectError(POST(SUBMIT_URL, submitPayload({ quantity: 0 }), alex), 400, 'INVALID_QUANTITY');
  });

  test('negative quantity is rejected', async () => {
    await expectError(POST(SUBMIT_URL, submitPayload({ quantity: -5 }), alex), 400, 'INVALID_QUANTITY');
  });

  test('fractional quantity is rejected at the protocol layer', async () => {
    await expectError(POST(SUBMIT_URL, submitPayload({ quantity: 20.5 }), alex), 400);
  });

  test('oversized quantity beyond availability is rejected with current availability', async () => {
    await expectError(
      POST(SUBMIT_URL, submitPayload({ quantity: 241 }), alex),
      409,
      'INSUFFICIENT_AVAILABILITY',
      'Only 240'
    );
  });

  test('absurdly large quantity is rejected by sanity cap', async () => {
    await expectError(POST(SUBMIT_URL, submitPayload({ quantity: 100001 }), alex), 400, 'INVALID_QUANTITY');
  });

  test('unknown material is rejected', async () => {
    await expectError(
      POST(SUBMIT_URL, submitPayload({ materialID: '99999999-9999-4999-8999-999999999999' }), alex),
      404,
      'MATERIAL_NOT_FOUND'
    );
  });

  test('inactive material is rejected', async () => {
    await expectError(
      POST(SUBMIT_URL, submitPayload({ materialID: IDS.mat1980, sourceWarehouseID: IDS.cairo, destinationWarehouseID: IDS.giza, quantity: 1 }), alex),
      400,
      'MATERIAL_INACTIVE'
    );
  });

  test('unknown source warehouse is rejected', async () => {
    await expectError(
      POST(SUBMIT_URL, submitPayload({ sourceWarehouseID: '99999999-9999-4999-8999-999999999999' }), alex),
      404,
      'WAREHOUSE_NOT_FOUND'
    );
  });

  test('inactive source warehouse is rejected', async () => {
    await expectError(
      POST(SUBMIT_URL, submitPayload({ sourceWarehouseID: INACTIVE_WAREHOUSE_ID }), alex),
      400,
      'WAREHOUSE_INACTIVE'
    );
  });

  test('source equal to destination is rejected', async () => {
    await expectError(
      POST(SUBMIT_URL, submitPayload({ sourceWarehouseID: IDS.cairo, destinationWarehouseID: IDS.cairo }), alex),
      400,
      'SOURCE_EQUALS_DESTINATION'
    );
  });

  test('note longer than 200 characters is rejected', async () => {
    // The OData protocol layer enforces String(200) on the action parameter
    // (ASSERT_DATA_TYPE) before the handler's own NOTE_TOO_LONG check.
    await expectError(POST(SUBMIT_URL, submitPayload({ note: 'x'.repeat(201) }), alex), 400);
  });

  test('malformed idempotency key is rejected', async () => {
    await expectError(POST(SUBMIT_URL, submitPayload({ idempotencyKey: 'short' }), alex), 400, 'INVALID_IDEMPOTENCY_KEY');
  });

  test('availability changed between review and submit is caught server-side', async () => {
    // Alex reviewed Suez (18 available) but stock dropped meanwhile.
    const stock = await db.run(
      cds.ql.SELECT.one.from(Stocks).where({ material_ID: IDS.mat1042, warehouse_ID: IDS.suez })
    );
    await db.run(cds.ql.UPDATE.entity(Stocks).set({ reservedQuantity: 15 }).where({ ID: stock.ID })); // now 5 available
    try {
      await expectError(
        POST(SUBMIT_URL, submitPayload({ sourceWarehouseID: IDS.suez, quantity: 10 }), alex),
        409,
        'INSUFFICIENT_AVAILABILITY',
        'Only 5'
      );
    } finally {
      await db.run(cds.ql.UPDATE.entity(Stocks).set({ reservedQuantity: stock.reservedQuantity }).where({ ID: stock.ID }));
    }
  });

  test('identical replay with the same key returns the existing request, creates nothing new', async () => {
    const payload = submitPayload();
    const first = await POST(SUBMIT_URL, payload, alex);
    const second = await POST(SUBMIT_URL, payload, alex);
    expect(second.data.ID).toBe(first.data.ID);
    expect(second.data.reference).toBe(first.data.reference);
    expect(second.data.replayed).toBe(true);

    const rows = await db.run(
      cds.ql.SELECT.from(TransferRequests).where({ idempotencyKey: payload.idempotencyKey })
    );
    expect(rows).toHaveLength(1);
    const events = await db.run(cds.ql.SELECT.from(RequestEvents).where({ request_ID: first.data.ID }));
    expect(events).toHaveLength(1);
  });

  test('same key with a different payload is rejected as a conflict', async () => {
    const payload = submitPayload();
    await POST(SUBMIT_URL, payload, alex);
    await expectError(
      POST(SUBMIT_URL, { ...payload, quantity: 21 }, alex),
      409,
      'IDEMPOTENCY_CONFLICT'
    );
  });

  test('the same idempotency key may be used by different users independently', async () => {
    const key = `shared-key-${Math.random().toString(36).slice(2, 10)}`;
    const a = await POST(SUBMIT_URL, submitPayload({ idempotencyKey: key }), alex);
    const d = await POST(
      SUBMIT_URL,
      submitPayload({ idempotencyKey: key, destinationWarehouseID: IDS.alexandria, sourceWarehouseID: IDS.giza, quantity: 5 }),
      dana
    );
    expect(a.data.ID).not.toBe(d.data.ID);
  });

  test('concurrent duplicate attempts create exactly one request', async () => {
    const payload = submitPayload();
    const results = await Promise.allSettled([
      POST(SUBMIT_URL, payload, alex),
      POST(SUBMIT_URL, payload, alex),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const references = new Set(fulfilled.map((r) => r.value.data.reference));
    expect(references.size).toBe(1);

    const rows = await db.run(
      cds.ql.SELECT.from(TransferRequests).where({ idempotencyKey: payload.idempotencyKey })
    );
    expect(rows).toHaveLength(1);
    const events = await db.run(cds.ql.SELECT.from(RequestEvents).where({ request_ID: rows[0].ID }));
    expect(events).toHaveLength(1);
  });

  test('user without the WarehouseUser role cannot submit', async () => {
    await expectError(POST(SUBMIT_URL, submitPayload(), bob), 403);
  });

  test('a failed submission rolls back completely - no request, no event, no consumed reference', async () => {
    const counterBefore = await db.run(cds.ql.SELECT.one.from(Counters).where({ name: 'transferRequest' }));
    const nextRef = `TR-${String(counterBefore.value + 1).padStart(6, '0')}`;

    // Force the INSERT itself to fail (unique reference collision) so the
    // transaction dies AFTER validation, counter increment, and deep insert began.
    const blocker = {
      ID: 'ffffffff-0000-4000-8000-00000000f001',
      reference: nextRef,
      material_ID: IDS.mat1042,
      sourceWarehouse_ID: IDS.giza,
      destinationWarehouse_ID: IDS.cairo,
      quantity: 1,
      status: 'AWAITING_APPROVAL',
      idempotencyKey: 'blocker-key-000000001',
      payloadFingerprint: 'blocker',
      createdBy: 'system.test',
      modifiedBy: 'system.test',
    };
    await db.run(cds.ql.INSERT.into(TransferRequests).entries(blocker));

    const payload = submitPayload();
    try {
      await expectError(POST(SUBMIT_URL, payload, alex), 500);

      const orphanRequests = await db.run(
        cds.ql.SELECT.from(TransferRequests).where({ idempotencyKey: payload.idempotencyKey })
      );
      expect(orphanRequests).toHaveLength(0);

      const counterAfter = await db.run(cds.ql.SELECT.one.from(Counters).where({ name: 'transferRequest' }));
      expect(counterAfter.value).toBe(counterBefore.value); // increment rolled back with the tx
    } finally {
      await db.run(cds.ql.DELETE.from(TransferRequests).where({ ID: blocker.ID }));
    }

    // The same payload succeeds once the collision is gone.
    const retry = await POST(SUBMIT_URL, payload, alex);
    expect(retry.data.reference).toBe(nextRef);
  });
});
