import cds from '@sap/cds';
import { nextReference, Runner } from './reference';
import { payloadFingerprint } from './fingerprint';

const { SELECT, INSERT } = cds.ql;

const HOURS = 3600 * 1000;

/** Fixed demo entity IDs (must match db/data/*.csv). */
export const IDS = {
  mat1042: 'aaaaaaaa-0000-4000-8000-000000001042',
  mat1156: 'aaaaaaaa-0000-4000-8000-000000001156',
  mat1287: 'aaaaaaaa-0000-4000-8000-000000001287',
  mat1330: 'aaaaaaaa-0000-4000-8000-000000001330',
  mat1408: 'aaaaaaaa-0000-4000-8000-000000001408',
  mat1523: 'aaaaaaaa-0000-4000-8000-000000001523',
  mat1980: 'aaaaaaaa-0000-4000-8000-000000001980',
  cairo: 'bbbbbbbb-0000-4000-8000-000000000001',
  alexandria: 'bbbbbbbb-0000-4000-8000-000000000002',
  giza: 'bbbbbbbb-0000-4000-8000-000000000003',
  suez: 'bbbbbbbb-0000-4000-8000-000000000004',
};

interface DemoRequest {
  user: string;
  materialID: string;
  materialCode: string;
  baseUnit: string;
  sourceID: string;
  destinationID: string;
  quantity: number;
  note: string | null;
  status: string;
  idempotencyKey: string;
  /** [eventType, hoursAgo, message?][] — oldest first, first entry must be SUBMITTED */
  events: Array<[string, number, string?]>;
}

const DEMO_REQUESTS: DemoRequest[] = [
  {
    user: 'alex', materialID: IDS.mat1156, materialCode: 'MAT-1156', baseUnit: 'EA',
    sourceID: IDS.alexandria, destinationID: IDS.cairo, quantity: 10,
    note: 'Replacement belts for packing line 2.', status: 'RECEIVED', idempotencyKey: 'demo-seed-received-0001',
    events: [
      ['SUBMITTED', 144, 'Transfer request submitted for 10 EA of MAT-1156.'],
      ['APPROVED', 138, 'Approved by warehouse supervisor.'],
      ['DISPATCHED', 120, 'Picked up by internal shuttle ALX-CAI.'],
      ['RECEIVED', 96, 'Goods received at Cairo Central Warehouse.'],
    ],
  },
  {
    // Source must be a warehouse that actually stocks MAT-1287 (SUZ: 80
    // available), so the seeded history is possible under the app's own rules.
    user: 'alex', materialID: IDS.mat1287, materialCode: 'MAT-1287', baseUnit: 'BOX',
    sourceID: IDS.suez, destinationID: IDS.cairo, quantity: 5,
    note: null, status: 'DISPATCHED', idempotencyKey: 'demo-seed-dispatched-0001',
    events: [
      ['SUBMITTED', 72, 'Transfer request submitted for 5 BOX of MAT-1287.'],
      ['APPROVED', 48, 'Approved by warehouse supervisor.'],
      ['DISPATCHED', 24, 'Picked up by internal shuttle SUZ-CAI.'],
    ],
  },
  {
    user: 'alex', materialID: IDS.mat1408, materialCode: 'MAT-1408', baseUnit: 'EA',
    sourceID: IDS.alexandria, destinationID: IDS.cairo, quantity: 40,
    note: 'Quarterly PPE top-up.', status: 'REJECTED', idempotencyKey: 'demo-seed-rejected-0001',
    events: [
      ['SUBMITTED', 50, 'Transfer request submitted for 40 EA of MAT-1408.'],
      ['REJECTED', 26, 'Quantity exceeds the monthly transfer cap for consumables.'],
    ],
  },
  {
    user: 'alex', materialID: IDS.mat1330, materialCode: 'MAT-1330', baseUnit: 'EA',
    sourceID: IDS.giza, destinationID: IDS.cairo, quantity: 12,
    note: 'Rollers for the returns lane rebuild.', status: 'AWAITING_APPROVAL', idempotencyKey: 'demo-seed-pending-0001',
    events: [
      ['SUBMITTED', 5, 'Transfer request submitted for 12 EA of MAT-1330.'],
    ],
  },
  {
    user: 'dana', materialID: IDS.mat1523, materialCode: 'MAT-1523', baseUnit: 'EA',
    sourceID: IDS.suez, destinationID: IDS.alexandria, quantity: 8,
    note: null, status: 'AWAITING_APPROVAL', idempotencyKey: 'demo-seed-pending-0002',
    events: [
      ['SUBMITTED', 26, 'Transfer request submitted for 8 EA of MAT-1523.'],
    ],
  },
];

/**
 * Inserts demo transfer requests with consistent, generated (relative)
 * timestamps. Idempotent: skips when the demo requests already exist.
 * Master data (materials, warehouses, stock) comes from CSV seeds.
 */
export async function seedDemoRequests(db: Runner & { run: (q: any) => Promise<any> }): Promise<number> {
  const { TransferRequests, RecentScans } = cds.entities('wl');
  const now = Date.now();

  const existing = await db.run(
    SELECT.from(TransferRequests).columns('ID').where({ idempotencyKey: DEMO_REQUESTS.map((r) => r.idempotencyKey) })
  );
  if (existing.length > 0) return 0;

  let inserted = 0;
  for (const r of DEMO_REQUESTS) {
    const reference = await nextReference(db);
    const submittedAt = new Date(now - r.events[0][1] * HOURS).toISOString();
    const lastEventAt = new Date(now - r.events[r.events.length - 1][1] * HOURS).toISOString();
    await db.run(
      INSERT.into(TransferRequests).entries({
        reference,
        material_ID: r.materialID,
        sourceWarehouse_ID: r.sourceID,
        destinationWarehouse_ID: r.destinationID,
        quantity: r.quantity,
        note: r.note,
        status: r.status,
        idempotencyKey: r.idempotencyKey,
        payloadFingerprint: payloadFingerprint({
          materialID: r.materialID,
          sourceWarehouseID: r.sourceID,
          destinationWarehouseID: r.destinationID,
          quantity: r.quantity,
          note: r.note,
        }),
        createdBy: r.user,
        modifiedBy: r.user,
        createdAt: submittedAt,
        modifiedAt: lastEventAt,
        events: r.events.map(([eventType, hoursAgo, message]) => ({
          eventType,
          timestamp: new Date(now - hoursAgo * HOURS).toISOString(),
          actor: eventType === 'SUBMITTED' ? r.user : 'supervisor.demo',
          message: message ?? null,
        })),
      })
    );
    inserted++;
  }

  // A couple of older scans so the Home page looks lived-in for Alex.
  await db.run(
    INSERT.into(RecentScans).entries([
      { userId: 'alex', material_ID: IDS.mat1287, scannedAt: new Date(now - 72 * HOURS).toISOString() },
      { userId: 'alex', material_ID: IDS.mat1156, scannedAt: new Date(now - 144 * HOURS).toISOString() },
    ])
  );

  return inserted;
}
