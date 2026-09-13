using { wl } from '../db/schema';

/**
 * WarehouseService — OData V4 contract consumed by the MDK client.
 *
 * Security model:
 *  - Every operation requires the WarehouseUser role.
 *  - Requests and their events are readable only by their creator;
 *    WarehouseAdmin may read everything.
 *  - Stock, request status, and audit events are NOT writable through
 *    this service — the only write path is submitTransferRequest.
 */
@requires: 'WarehouseUser'
@path: '/odata/v4/warehouse'
service WarehouseService {

  @readonly
  entity Materials as projection on wl.Materials excluding { stocks };

  @readonly
  entity Warehouses as projection on wl.Warehouses;

  /** Availability is always onHandQuantity - reservedQuantity. */
  @readonly
  entity StockAvailability as
    select from wl.Stocks {
      ID,
      material,
      material.materialCode              as materialCode,
      material.name                      as materialName,
      material.baseUnit                  as baseUnit,
      material.active                    as materialActive,
      warehouse,
      warehouse.code                     as warehouseCode,
      warehouse.name                     as warehouseName,
      warehouse.city                     as warehouseCity,
      warehouse.active                   as warehouseActive,
      onHandQuantity,
      reservedQuantity,
      onHandQuantity - reservedQuantity  as availableQuantity : Integer,
      reorderPoint,
      modifiedAt
    };

  @readonly
  @restrict: [
    { grant: 'READ', to: 'WarehouseUser', where: 'createdBy = $user' },
    { grant: 'READ', to: 'WarehouseAdmin' }
  ]
  entity TransferRequests as projection on wl.TransferRequests
    excluding { idempotencyKey, payloadFingerprint };

  @readonly
  @restrict: [
    { grant: 'READ', to: 'WarehouseUser', where: 'request.createdBy = $user' },
    { grant: 'READ', to: 'WarehouseAdmin' }
  ]
  entity RequestEvents as projection on wl.RequestEvents;

  @readonly
  @restrict: [
    { grant: 'READ', to: 'WarehouseUser', where: 'userId = $user' },
    { grant: 'READ', to: 'WarehouseAdmin' }
  ]
  entity RecentScans as projection on wl.RecentScans;

  /** Result of a transfer-request submission. */
  type SubmitResult {
    ID              : UUID;
    reference       : String(20);
    status          : String(20);
    createdAt       : Timestamp;
    quantity        : Integer;
    materialCode    : String(20);
    materialName    : String(100);
    sourceCode      : String(10);
    sourceName      : String(100);
    destinationCode : String(10);
    destinationName : String(100);
    /** true when an identical earlier attempt was returned instead of a new request */
    replayed        : Boolean;
  }

  /**
   * Creates a transfer request (status AWAITING_APPROVAL) plus its
   * SUBMITTED event atomically. Idempotent per (requester, idempotencyKey):
   * an identical replay returns the existing request; the same key with a
   * different payload is rejected. Does not reserve or move stock.
   */
  action submitTransferRequest(
    materialID             : UUID not null,
    sourceWarehouseID      : UUID not null,
    destinationWarehouseID : UUID not null,
    quantity               : Integer not null,
    note                   : String(200),
    idempotencyKey         : String(64) not null
  ) returns SubmitResult;

  type DashboardCounts {
    userDisplayName    : String(100);
    homeWarehouseID    : UUID;
    homeWarehouseCode  : String(10);
    homeWarehouseName  : String(100);
    homeWarehouseCity  : String(100);
    pendingCount       : Integer;
    lowStockCount      : Integer;
  }

  /**
   * Counts derived from live data for the Home page. Modeled as an OData
   * action (POST) rather than a function: the MDK CallFunction pattern and
   * its validator resolve ActionImports; the operation itself is read-only.
   */
  action getDashboard() returns DashboardCounts;

  /**
   * Records a successful scan in the requester's recent-scan history
   * (deduplicated per material, bounded server-side).
   */
  action recordScan(materialID : UUID not null) returns Boolean;
}
