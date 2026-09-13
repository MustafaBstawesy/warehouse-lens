import cds from '@sap/cds';
import { nextReference } from './lib/reference';
import { payloadFingerprint } from './lib/fingerprint';

const { SELECT, INSERT, UPDATE, DELETE } = cds.ql;

const RECENT_SCANS_LIMIT = 10;
const MAX_NOTE_LENGTH = 200;
const MAX_QUANTITY = 100000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

interface SubmitParams {
  materialID: string;
  sourceWarehouseID: string;
  destinationWarehouseID: string;
  quantity: number;
  note?: string | null;
  idempotencyKey: string;
}

class WarehouseService extends cds.ApplicationService {
  async init() {
    this.on('submitTransferRequest', (req) => this.onSubmitTransferRequest(req as cds.Request));
    this.on('getDashboard', (req) => this.onGetDashboard(req as cds.Request));
    this.on('recordScan', (req) => this.onRecordScan(req as cds.Request));
    await super.init();
  }

  /**
   * Creates a transfer request + SUBMITTED event atomically, idempotent per
   * (requester, idempotencyKey). Submitting never reserves or moves stock —
   * approval is a separate step, so several pending requests may together
   * exceed the currently available quantity; approval must revalidate.
   */
  private async onSubmitTransferRequest(req: cds.Request) {
    const db = cds.db;
    const { Materials, Warehouses, Stocks, TransferRequests } = cds.entities('wl');
    const data = req.data as SubmitParams;
    const requester = req.user?.id;
    if (!requester || requester === 'anonymous') {
      return req.reject({ status: 401, code: 'UNAUTHENTICATED', message: 'Sign in to submit a transfer request.' });
    }

    // --- validate scalar inputs -------------------------------------------
    const quantity = data.quantity;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      return req.reject({ status: 400, code: 'INVALID_QUANTITY', message: 'Quantity must be a positive whole number.' });
    }
    if (quantity > MAX_QUANTITY) {
      return req.reject({ status: 400, code: 'INVALID_QUANTITY', message: `Quantity cannot exceed ${MAX_QUANTITY}.` });
    }
    const note = typeof data.note === 'string' && data.note.trim().length > 0 ? data.note.trim() : null;
    if (note && note.length > MAX_NOTE_LENGTH) {
      return req.reject({ status: 400, code: 'NOTE_TOO_LONG', message: `Note must be at most ${MAX_NOTE_LENGTH} characters.` });
    }
    const idempotencyKey = (data.idempotencyKey || '').trim();
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return req.reject({ status: 400, code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency key must be 8-64 characters (letters, digits, ".", "_", "-").' });
    }
    if (!data.materialID || !data.sourceWarehouseID || !data.destinationWarehouseID) {
      return req.reject({ status: 400, code: 'MISSING_PARAMETER', message: 'Material, source warehouse, and destination warehouse are required.' });
    }
    if (data.sourceWarehouseID === data.destinationWarehouseID) {
      return req.reject({ status: 400, code: 'SOURCE_EQUALS_DESTINATION', message: 'Source and destination warehouses must be different.' });
    }

    // --- validate referenced entities -------------------------------------
    const material = await db.run(SELECT.one.from(Materials).where({ ID: data.materialID }));
    if (!material) {
      return req.reject({ status: 404, code: 'MATERIAL_NOT_FOUND', message: 'This material does not exist. Rescan the label or check the material ID.' });
    }
    if (!material.active) {
      return req.reject({ status: 400, code: 'MATERIAL_INACTIVE', message: `${material.materialCode} is inactive and cannot be transferred.` });
    }
    const source = await db.run(SELECT.one.from(Warehouses).where({ ID: data.sourceWarehouseID }));
    if (!source) {
      return req.reject({ status: 404, code: 'WAREHOUSE_NOT_FOUND', message: 'The source warehouse does not exist.' });
    }
    if (!source.active) {
      return req.reject({ status: 400, code: 'WAREHOUSE_INACTIVE', message: `${source.name} is not an active warehouse.` });
    }
    const destination = await db.run(SELECT.one.from(Warehouses).where({ ID: data.destinationWarehouseID }));
    if (!destination) {
      return req.reject({ status: 404, code: 'WAREHOUSE_NOT_FOUND', message: 'The destination warehouse does not exist.' });
    }
    if (!destination.active) {
      return req.reject({ status: 400, code: 'WAREHOUSE_INACTIVE', message: `${destination.name} is not an active warehouse.` });
    }

    // --- idempotent replay check ------------------------------------------
    const fingerprint = payloadFingerprint({
      materialID: data.materialID,
      sourceWarehouseID: data.sourceWarehouseID,
      destinationWarehouseID: data.destinationWarehouseID,
      quantity,
      note,
    });
    const existing = await db.run(
      SELECT.one.from(TransferRequests).where({ createdBy: requester, idempotencyKey })
    );
    if (existing) {
      return this.replayOrConflict(req, existing, fingerprint, material, source, destination);
    }

    // --- availability recheck (server-side, current data) ------------------
    const stock = await db.run(
      SELECT.one.from(Stocks).where({ material_ID: data.materialID, warehouse_ID: data.sourceWarehouseID })
    );
    const available = stock ? (stock.onHandQuantity ?? 0) - (stock.reservedQuantity ?? 0) : 0;
    if (quantity > available) {
      return req.reject({
        status: 409,
        code: 'INSUFFICIENT_AVAILABILITY',
        message: `Only ${available} ${material.baseUnit} of ${material.materialCode} ${available === 1 ? 'is' : 'are'} available at ${source.name} right now. Adjust the quantity and try again.`,
      });
    }

    // --- create request + SUBMITTED event atomically -----------------------
    // All statements below run in this request's transaction: a failure at
    // any point rolls back the counter increment, the request, and the event.
    const reference = await nextReference(db);
    const ID = cds.utils.uuid();
    try {
      await db.run(
        INSERT.into(TransferRequests).entries({
          ID,
          reference,
          material_ID: data.materialID,
          sourceWarehouse_ID: data.sourceWarehouseID,
          destinationWarehouse_ID: data.destinationWarehouseID,
          quantity,
          note,
          status: 'AWAITING_APPROVAL',
          idempotencyKey,
          payloadFingerprint: fingerprint,
          createdBy: requester,
          modifiedBy: requester,
          events: [
            {
              eventType: 'SUBMITTED',
              actor: requester,
              message: `Transfer request submitted for ${quantity} ${material.baseUnit} of ${material.materialCode}.`,
            },
          ],
        })
      );
    } catch (e: unknown) {
      // Concurrent duplicate attempt: the unique (createdBy, idempotencyKey)
      // constraint is the arbiter. The loser replays the winner's request.
      if (isUniqueConstraintError(e)) {
        const winner = await db.run(
          SELECT.one.from(TransferRequests).where({ createdBy: requester, idempotencyKey })
        );
        if (winner) {
          return this.replayOrConflict(req, winner, fingerprint, material, source, destination);
        }
      }
      throw e;
    }

    const created = await db.run(SELECT.one.from(TransferRequests).where({ ID }));
    return {
      ID: created.ID,
      reference: created.reference,
      status: created.status,
      createdAt: created.createdAt,
      quantity: created.quantity,
      materialCode: material.materialCode,
      materialName: material.name,
      sourceCode: source.code,
      sourceName: source.name,
      destinationCode: destination.code,
      destinationName: destination.name,
      replayed: false,
    };
  }

  /** Identical replay returns the stored request; a different payload under the same key is rejected. */
  private replayOrConflict(
    req: cds.Request,
    existing: any,
    fingerprint: string,
    material: any,
    source: any,
    destination: any
  ) {
    if (existing.payloadFingerprint !== fingerprint) {
      return req.reject({
        status: 409,
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'This submission attempt was already used with different values. Review the request and submit again.',
      });
    }
    return {
      ID: existing.ID,
      reference: existing.reference,
      status: existing.status,
      createdAt: existing.createdAt,
      quantity: existing.quantity,
      materialCode: material.materialCode,
      materialName: material.name,
      sourceCode: source.code,
      sourceName: source.name,
      destinationCode: destination.code,
      destinationName: destination.name,
      replayed: true,
    };
  }

  /** Live counts for the Home page, derived from persisted data. */
  private async onGetDashboard(req: cds.Request) {
    const db = cds.db;
    const { EmployeeProfiles, Warehouses, Stocks, Materials, TransferRequests } = cds.entities('wl');
    const requester = req.user?.id ?? 'anonymous';

    const profile = await db.run(SELECT.one.from(EmployeeProfiles).where({ userId: requester }));
    const home = profile
      ? await db.run(SELECT.one.from(Warehouses).where({ ID: profile.homeWarehouse_ID }))
      : null;

    const pendingRows = (await db.run(
      SELECT.from(TransferRequests).columns('ID').where({ createdBy: requester, status: 'AWAITING_APPROVAL' })
    )) as any[];

    let lowStockCount = 0;
    if (home) {
      // Low stock: available (onHand - reserved) at the home warehouse is at
      // or below the reorder point, for active materials only. Demo-scale
      // data, so the derivation runs in the service layer.
      const stocks = (await db.run(SELECT.from(Stocks).where({ warehouse_ID: home.ID }))) as any[];
      const materialIDs = stocks.map((s: any) => s.material_ID);
      const materials = (materialIDs.length
        ? await db.run(SELECT.from(Materials).columns('ID', 'active').where({ ID: materialIDs }))
        : []) as any[];
      const activeById = new Map(materials.map((m: any) => [m.ID, m.active]));
      lowStockCount = stocks.filter((s: any) => {
        const available = (s.onHandQuantity ?? 0) - (s.reservedQuantity ?? 0);
        return activeById.get(s.material_ID) === true && available <= (s.reorderPoint ?? 0);
      }).length;
    }

    return {
      userDisplayName: profile?.displayName ?? requester,
      homeWarehouseID: home?.ID ?? null,
      homeWarehouseCode: home?.code ?? null,
      homeWarehouseName: home?.name ?? null,
      homeWarehouseCity: home?.city ?? null,
      pendingCount: pendingRows.length,
      lowStockCount,
    };
  }

  /** Upserts the requester's recent-scan entry for a material, bounded history. */
  private async onRecordScan(req: cds.Request) {
    const db = cds.db;
    const { Materials, RecentScans } = cds.entities('wl');
    const requester = req.user?.id;
    if (!requester || requester === 'anonymous') {
      return req.reject({ status: 401, code: 'UNAUTHENTICATED', message: 'Sign in to record scans.' });
    }
    const materialID = req.data.materialID as string;
    const material = await db.run(SELECT.one.from(Materials).where({ ID: materialID }));
    if (!material) {
      return req.reject({ status: 404, code: 'MATERIAL_NOT_FOUND', message: 'Unknown material.' });
    }

    const now = new Date().toISOString();
    const updated = await db.run(
      UPDATE.entity(RecentScans).set({ scannedAt: now }).where({ userId: requester, material_ID: materialID })
    );
    if (updated === 0) {
      try {
        await db.run(INSERT.into(RecentScans).entries({ userId: requester, material_ID: materialID, scannedAt: now }));
      } catch (e: unknown) {
        if (!isUniqueConstraintError(e)) throw e;
        await db.run(
          UPDATE.entity(RecentScans).set({ scannedAt: now }).where({ userId: requester, material_ID: materialID })
        );
      }
    }

    // Bound the per-user history to the most recent entries.
    const rows = (await db.run(
      SELECT.from(RecentScans).columns('ID').where({ userId: requester }).orderBy({ scannedAt: 'desc' } as any)
    )) as any[];
    if (rows.length > RECENT_SCANS_LIMIT) {
      const surplus = rows.slice(RECENT_SCANS_LIMIT).map((r: any) => r.ID);
      await db.run(DELETE.from(RecentScans).where({ ID: surplus }));
    }
    return true;
  }
}

function isUniqueConstraintError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /unique/i.test(msg) || /SQLITE_CONSTRAINT/i.test(msg) || (e as any)?.code === 301;
}

export = WarehouseService;
