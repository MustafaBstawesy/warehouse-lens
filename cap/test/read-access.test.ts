import cds from '@sap/cds';
import { seedDemoRequests, IDS } from '../srv/lib/seed-demo';

const capTest = (cds as any).test(__dirname + '/..');
const { GET, POST, PATCH } = capTest;

const alex = { auth: { username: 'alex', password: '' } };
const dana = { auth: { username: 'dana', password: '' } };
const sam = { auth: { username: 'sam', password: '' } };
const bob = { auth: { username: 'bob', password: '' } };

const BASE = '/odata/v4/warehouse';

async function expectError(promise: Promise<unknown>, status: number) {
  try {
    await promise;
    throw new Error(`expected request to fail with HTTP ${status}, but it succeeded`);
  } catch (e: any) {
    if (!e.response) throw e;
    expect(e.response.status).toBe(status);
  }
}

describe('read access, availability, dashboard, recent scans', () => {
  let db: any;

  beforeAll(async () => {
    db = await cds.connect.to('db');
    await seedDemoRequests(db);
  });

  test('MAT-1042 availability matches the demo inventory exactly', async () => {
    const { data } = await GET(
      `${BASE}/StockAvailability?$filter=materialCode eq 'MAT-1042'&$orderby=availableQuantity desc`,
      alex
    );
    const byCode = Object.fromEntries(data.value.map((r: any) => [r.warehouseCode, r.availableQuantity]));
    expect(byCode).toEqual({ ALX: 240, GIZ: 65, SUZ: 18, CAI: 0 });
    expect(data.value.every((r: any) => r.baseUnit === 'EA')).toBe(true);
  });

  test('availability is always onHand minus reserved', async () => {
    const { data } = await GET(`${BASE}/StockAvailability?$top=200`, alex);
    for (const row of data.value) {
      expect(row.availableQuantity).toBe(row.onHandQuantity - row.reservedQuantity);
    }
  });

  test('find-stock query excludes the destination and sorts by availability descending', async () => {
    const { data } = await GET(
      `${BASE}/StockAvailability?$filter=material_ID eq ${IDS.mat1042} and warehouse_ID ne ${IDS.cairo} and warehouseActive eq true and availableQuantity gt 0&$orderby=availableQuantity desc`,
      alex
    );
    expect(data.value.map((r: any) => r.warehouseCode)).toEqual(['ALX', 'GIZ', 'SUZ']);
  });

  test('users see only their own transfer requests', async () => {
    const alexRes = await GET(`${BASE}/TransferRequests`, alex);
    expect(alexRes.data.value.length).toBeGreaterThanOrEqual(4);
    expect(alexRes.data.value.every((r: any) => r.createdBy === 'alex')).toBe(true);

    const danaRes = await GET(`${BASE}/TransferRequests`, dana);
    expect(danaRes.data.value.every((r: any) => r.createdBy === 'dana')).toBe(true);
  });

  test("another user's request is not accessible by key", async () => {
    const danaRows = await db.run(
      cds.ql.SELECT.from(cds.entities('wl').TransferRequests).where({ createdBy: 'dana' })
    );
    expect(danaRows.length).toBeGreaterThanOrEqual(1);
    await expectError(GET(`${BASE}/TransferRequests(${danaRows[0].ID})`, alex), 404);
  });

  test("another user's request events are not accessible directly or via navigation", async () => {
    const danaRows = await db.run(
      cds.ql.SELECT.from(cds.entities('wl').TransferRequests).where({ createdBy: 'dana' })
    );
    const danaRequest = danaRows[0];

    const direct = await GET(`${BASE}/RequestEvents?$filter=request_ID eq ${danaRequest.ID}`, alex);
    expect(direct.data.value).toHaveLength(0);

    // Navigation access: either denied outright or filtered to an empty
    // result - it must NEVER return another user's events.
    try {
      const nav = await GET(`${BASE}/TransferRequests(${danaRequest.ID})/events`, alex);
      expect(nav.data.value).toHaveLength(0);
    } catch (e: any) {
      if (!e.response) throw e;
      expect([403, 404]).toContain(e.response.status);
    }
  });

  test('admin role can read all requests and events', async () => {
    const { data } = await GET(`${BASE}/TransferRequests`, sam);
    const owners = new Set(data.value.map((r: any) => r.createdBy));
    expect(owners.has('alex')).toBe(true);
    expect(owners.has('dana')).toBe(true);
  });

  test('user without WarehouseUser role gets no read access at all', async () => {
    await expectError(GET(`${BASE}/Materials`, bob), 403);
    await expectError(GET(`${BASE}/TransferRequests`, bob), 403);
  });

  test('idempotency internals are not exposed through the service', async () => {
    const { data } = await GET(`${BASE}/TransferRequests?$top=1`, alex);
    expect(data.value[0].idempotencyKey).toBeUndefined();
    expect(data.value[0].payloadFingerprint).toBeUndefined();
  });

  test('stock, request status, and events are not writable through the service', async () => {
    const stockRows = await db.run(cds.ql.SELECT.from(cds.entities('wl').Stocks).limit(1));
    await expectError(
      PATCH(`${BASE}/StockAvailability(${stockRows[0].ID})`, { onHandQuantity: 99999 }, alex),
      405
    );
    const alexRows = await db.run(
      cds.ql.SELECT.from(cds.entities('wl').TransferRequests).where({ createdBy: 'alex' })
    );
    await expectError(PATCH(`${BASE}/TransferRequests(${alexRows[0].ID})`, { status: 'APPROVED' }, alex), 405);
    await expectError(
      POST(`${BASE}/RequestEvents`, { request_ID: alexRows[0].ID, eventType: 'APPROVED' }, alex),
      405
    );
  });

  test('request list supports status filter, search, and pagination', async () => {
    const filtered = await GET(
      `${BASE}/TransferRequests?$filter=status eq 'AWAITING_APPROVAL'&$orderby=createdAt desc&$top=10`,
      alex
    );
    expect(filtered.data.value.length).toBeGreaterThanOrEqual(1);
    expect(filtered.data.value.every((r: any) => r.status === 'AWAITING_APPROVAL')).toBe(true);

    const paged = await GET(`${BASE}/TransferRequests?$top=2&$skip=0&$count=true&$orderby=createdAt desc`, alex);
    expect(paged.data.value.length).toBeLessThanOrEqual(2);
    expect(paged.data['@odata.count']).toBeGreaterThanOrEqual(4);

    const searched = await GET(`${BASE}/TransferRequests?$filter=contains(reference,'TR-')&$top=5`, alex);
    expect(searched.data.value.length).toBeGreaterThanOrEqual(1);
  });

  test('request detail exposes ordered events for the timeline', async () => {
    const received = await GET(
      `${BASE}/TransferRequests?$filter=status eq 'RECEIVED'&$expand=events($orderby=timestamp asc)`,
      alex
    );
    const request = received.data.value[0];
    expect(request.events.map((e: any) => e.eventType)).toEqual([
      'SUBMITTED',
      'APPROVED',
      'DISPATCHED',
      'RECEIVED',
    ]);
    // Timestamps strictly ordered - consistent generated history.
    const times = request.events.map((e: any) => new Date(e.timestamp).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  test('dashboard counts are derived from data', async () => {
    const { data } = await POST(`${BASE}/getDashboard`, {}, alex);
    expect(data.userDisplayName).toBe('Alex');
    expect(data.homeWarehouseCode).toBe('CAI');
    expect(data.homeWarehouseCity).toBe('Cairo');
    // Seeded: exactly one AWAITING_APPROVAL request for alex (other tests add
    // theirs with unique keys; count must be at least the seeded one).
    expect(data.pendingCount).toBeGreaterThanOrEqual(1);
    // Cairo low stock from CSV seed: MAT-1042 (0<=10), MAT-1156 (8<=12),
    // MAT-1330 (3<=6), MAT-1099 (2<=2). MAT-1980 is inactive and excluded.
    expect(data.lowStockCount).toBe(4);
  });

  test('dashboard for a user without a profile falls back gracefully', async () => {
    // kim has the WarehouseUser role but NO EmployeeProfiles row.
    const kim = { auth: { username: 'kim', password: '' } };
    const { data } = await POST(`${BASE}/getDashboard`, {}, kim);
    expect(data.userDisplayName).toBe('kim'); // raw user id fallback
    expect(data.homeWarehouseCode).toBeNull();
    expect(data.pendingCount).toBe(0);
    expect(data.lowStockCount).toBe(0);
  });

  test('dashboard resolves the profile of an admin user too', async () => {
    const { data } = await POST(`${BASE}/getDashboard`, {}, sam);
    expect(data.userDisplayName).toBe('Sam');
    expect(data.homeWarehouseCode).toBe('CAI');
  });

  test('recordScan validates the material and deduplicates per user', async () => {
    await expectError(
      POST(`${BASE}/recordScan`, { materialID: '99999999-9999-4999-8999-999999999999' }, dana),
      404
    );

    await POST(`${BASE}/recordScan`, { materialID: IDS.mat1042 }, dana);
    await POST(`${BASE}/recordScan`, { materialID: IDS.mat1042 }, dana);
    const { data } = await GET(`${BASE}/RecentScans?$filter=material_ID eq ${IDS.mat1042}`, dana);
    expect(data.value).toHaveLength(1);
    expect(data.value[0].userId).toBe('dana');
  });

  test('recent scans are scoped to the user and bounded', async () => {
    // Dana scans every material (11 exist incl. the inactive one is not scannable
    // via details flow, but recordScan only requires existence).
    const materials = await db.run(cds.ql.SELECT.from(cds.entities('wl').Materials).columns('ID'));
    for (const m of materials) {
      await POST(`${BASE}/recordScan`, { materialID: m.ID }, dana);
    }
    const danaScans = await GET(`${BASE}/RecentScans?$orderby=scannedAt desc`, dana);
    expect(danaScans.data.value.length).toBeLessThanOrEqual(10);
    expect(danaScans.data.value.every((r: any) => r.userId === 'dana')).toBe(true);

    // Alex's history is untouched by Dana's scans.
    const alexScans = await GET(`${BASE}/RecentScans`, alex);
    expect(alexScans.data.value.every((r: any) => r.userId === 'alex')).toBe(true);
  });
});
