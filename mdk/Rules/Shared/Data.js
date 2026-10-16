/**
 * Data access layer: all OData reads and action calls go through here.
 * Online-only MVP - every helper returns a promise; callers own error UX.
 */
import { SERVICE, RECENT_SCANS_LIMIT, REQUESTS_PAGE_SIZE } from './Config';
import { toArray, unwrapActionResult, escapeODataLiteral } from './Format';
import { getSession } from './Session';

/**
 * Runs the idempotent OData service Initialize before every data call.
 * On a device the launch-time initialize can be skipped or fail (no
 * network yet, onboarding still finishing); without a data provider every
 * read fails with "No data provider exists". Initializing here makes the
 * first user action recover on its own (device-proven pattern).
 */
export function ensureService(context) {
    return context.executeAction('/mdk/Actions/Service/InitializeService.action')
        .then(function () {
            getSession().initialized = true;
        });
}

/** getDashboard() - live counts for Home. */
export function loadDashboard(context) {
    return ensureService(context).then(function () {
        return context.executeAction('/mdk/Actions/Service/GetDashboard.action');
    }).then(function (result) {
        const data = unwrapActionResult(result) || null;
        getSession().dashboard = data;
        return data;
    });
}

/** Recent scans for the current user, newest first, with material data. */
export function loadRecentScans(context) {
    const query = '$expand=material&$orderby=scannedAt desc&$top=' + RECENT_SCANS_LIMIT;
    return ensureService(context).then(function () {
        return context.read(SERVICE, 'RecentScans', [], query);
    }).then(function (res) {
        const rows = toArray(res);
        getSession().recentScans = rows;
        return rows;
    });
}

/** Find one material by its (scanned or typed) code. Resolves null when unknown. */
export function findMaterialByCode(context, code) {
    const safe = escapeODataLiteral(code);
    const query = "$filter=materialCode eq '" + safe + "'&$top=1";
    return ensureService(context).then(function () {
        return context.read(SERVICE, 'Materials', [], query);
    }).then(function (res) {
        const rows = toArray(res);
        return rows.length > 0 ? rows[0] : null;
    });
}

/** Availability row for one material at one warehouse (null when no record). */
export function loadStockAt(context, materialID, warehouseID) {
    const query = '$filter=material_ID eq ' + materialID + ' and warehouse_ID eq ' + warehouseID + '&$top=1';
    return ensureService(context).then(function () {
        return context.read(SERVICE, 'StockAvailability', [], query);
    }).then(function (res) {
        const rows = toArray(res);
        return rows.length > 0 ? rows[0] : null;
    });
}

/**
 * Source candidates: other ACTIVE warehouses with available stock for the
 * material, sorted by availability descending. The destination is excluded.
 * No distance or "nearest" ranking - the data does not contain distances.
 */
export function loadSources(context, materialID, destinationWarehouseID) {
    const query = '$filter=material_ID eq ' + materialID +
        ' and warehouse_ID ne ' + destinationWarehouseID +
        ' and warehouseActive eq true and materialActive eq true and availableQuantity gt 0' +
        '&$orderby=availableQuantity desc';
    return ensureService(context).then(function () {
        return context.read(SERVICE, 'StockAvailability', [], query);
    }).then(function (res) {
        return toArray(res);
    });
}

/** Requests list (own requests only - enforced server-side), bounded. */
export function loadRequests(context, statusFilter, search) {
    const clauses = [];
    if (statusFilter && statusFilter !== 'ALL') {
        clauses.push("status eq '" + escapeODataLiteral(statusFilter) + "'");
    }
    if (search) {
        const s = escapeODataLiteral(search);
        clauses.push("(contains(reference,'" + s + "') or contains(material/materialCode,'" + s + "'))");
    }
    let query = '$expand=material,sourceWarehouse,destinationWarehouse' +
        '&$orderby=createdAt desc&$top=' + REQUESTS_PAGE_SIZE;
    if (clauses.length > 0) {
        query += '&$filter=' + clauses.join(' and ');
    }
    return ensureService(context).then(function () {
        return context.read(SERVICE, 'TransferRequests', [], query);
    }).then(function (res) {
        return toArray(res);
    });
}

/** One request with everything the detail page needs. Resolves null when gone. */
export function loadRequestDetail(context, requestID) {
    const query = '$filter=ID eq ' + requestID +
        '&$expand=material,sourceWarehouse,destinationWarehouse,events($orderby=timestamp asc)';
    return ensureService(context).then(function () {
        return context.read(SERVICE, 'TransferRequests', [], query);
    }).then(function (res) {
        const rows = toArray(res);
        return rows.length > 0 ? rows[0] : null;
    });
}

/** Records a scan server-side; failures are the caller's choice to surface. */
export function recordScan(context, materialID) {
    return ensureService(context).then(function () {
        return context.executeAction({
            Name: '/mdk/Actions/Service/RecordScan.action',
            Properties: {
                Target: {
                    Service: SERVICE,
                    Function: {
                        Name: 'recordScan',
                        Parameters: { materialID: materialID }
                    }
                }
            }
        });
    });
}

/** Submits the transfer request (server revalidates everything). */
export function submitTransferRequest(context, payload) {
    return ensureService(context).then(function () {
        return context.executeAction({
            Name: '/mdk/Actions/Service/SubmitTransferRequest.action',
            Properties: {
                Target: {
                    Service: SERVICE,
                    Function: {
                        Name: 'submitTransferRequest',
                        Parameters: {
                            materialID: payload.materialID,
                            sourceWarehouseID: payload.sourceWarehouseID,
                            destinationWarehouseID: payload.destinationWarehouseID,
                            quantity: payload.quantity,
                            note: payload.note,
                            idempotencyKey: payload.idempotencyKey
                        }
                    }
                }
            }
        });
    }).then(function (result) {
        return unwrapActionResult(result);
    });
}

export default function Data() {
    return '';
}
