namespace wl;

using { cuid, managed } from '@sap/cds/common';

/**
 * Status lifecycle of an internal transfer request.
 * New requests always enter AWAITING_APPROVAL — submitting is a request,
 * not an approval, dispatch, or stock reservation.
 */
type RequestStatus : String(20) enum {
  AWAITING_APPROVAL = 'AWAITING_APPROVAL';
  APPROVED          = 'APPROVED';
  DISPATCHED        = 'DISPATCHED';
  RECEIVED          = 'RECEIVED';
  REJECTED          = 'REJECTED';
}

type EventType : String(20) enum {
  SUBMITTED  = 'SUBMITTED';
  APPROVED   = 'APPROVED';
  DISPATCHED = 'DISPATCHED';
  RECEIVED   = 'RECEIVED';
  REJECTED   = 'REJECTED';
}

@assert.unique: { materialCode: [ materialCode ] }
entity Materials : cuid, managed {
  materialCode : String(20)  @mandatory;
  name         : String(100) @mandatory;
  description  : String(500);
  baseUnit     : String(3)   @mandatory; // e.g. EA, PC, BOX
  imagePath    : String(255);            // client-bundled asset path, not a URL
  active       : Boolean default true;
  stocks       : Composition of many Stocks on stocks.material = $self;
}

@assert.unique: { code: [ code ] }
entity Warehouses : cuid, managed {
  code   : String(10)  @mandatory;
  name   : String(100) @mandatory;
  city   : String(100);
  active : Boolean default true;
}

/**
 * One record per material + warehouse (enforced by unique constraint).
 * availableQuantity is always derived as onHandQuantity - reservedQuantity.
 */
@assert.unique: { materialWarehouse: [ material, warehouse ] }
entity Stocks : cuid {
  material         : Association to Materials  @mandatory;
  warehouse        : Association to Warehouses @mandatory;
  onHandQuantity   : Integer @mandatory @assert.range: [ 0, 999999999 ];
  reservedQuantity : Integer default 0 @assert.range: [ 0, 999999999 ];
  reorderPoint     : Integer default 0 @assert.range: [ 0, 999999999 ];
  modifiedAt       : Timestamp @cds.on.insert: $now @cds.on.update: $now;
}

/**
 * Internal stock transfer request. Submitting does NOT reserve stock and
 * does NOT decrement inventory — approval is a separate, future step.
 */
@assert.unique: {
  reference      : [ reference ],
  idempotencyKey : [ createdBy, idempotencyKey ]
}
entity TransferRequests : cuid, managed {
  reference            : String(20) @mandatory;      // e.g. TR-000042, server-generated
  material             : Association to Materials  @mandatory;
  sourceWarehouse      : Association to Warehouses @mandatory;
  destinationWarehouse : Association to Warehouses @mandatory;
  quantity             : Integer @mandatory;
  note                 : String(200);
  status               : RequestStatus @mandatory default #AWAITING_APPROVAL;
  idempotencyKey       : String(64) @mandatory;
  payloadFingerprint   : String(64) @mandatory;      // SHA-256 of canonical payload
  events               : Composition of many RequestEvents on events.request = $self;
}

entity RequestEvents : cuid {
  request   : Association to TransferRequests @mandatory;
  eventType : EventType @mandatory;
  timestamp : Timestamp @cds.on.insert: $now;
  actor     : String(255);
  message   : String(255);
}

/** Maps an authenticated user to their home (destination) warehouse. */
@assert.unique: { userId: [ userId ] }
entity EmployeeProfiles : cuid {
  userId        : String(255) @mandatory;
  displayName   : String(100);
  homeWarehouse : Association to Warehouses @mandatory;
}

/**
 * Per-user recent-scan history (server-side so it survives app restarts
 * and stays consistent across devices). Deduplicated per user + material.
 */
@assert.unique: { userMaterial: [ userId, material ] }
entity RecentScans : cuid {
  userId    : String(255) @mandatory;
  material  : Association to Materials @mandatory;
  scannedAt : Timestamp @cds.on.insert: $now @cds.on.update: $now;
}

/** Internal, never exposed: transaction-safe reference numbering. */
entity Counters {
  key name  : String(30);
  value     : Integer;
}
