/**
 * Cross-page flow helpers for the scan -> details -> find stock -> review flow.
 */
import { getSession, resetFlow } from './Session';
import { loadDashboard, loadStockAt, recordScan } from './Data';
import { showMessage } from './Ui';
import { errorMessage } from './Format';

/**
 * Enters the material flow for a resolved material row and navigates to the
 * details page. Loads local availability at the user's home warehouse first,
 * so the page renders complete. recordHistory=true also records the scan
 * server-side (best-effort - a history failure never blocks the flow).
 */
export function openMaterial(context, material, recordHistory) {
    const s = getSession();
    resetFlow();
    s.flow.material = material;

    const ensureDashboard = s.dashboard
        ? Promise.resolve(s.dashboard)
        : loadDashboard(context);

    return ensureDashboard
        .then(function (dashboard) {
            if (!dashboard || !dashboard.homeWarehouseID) {
                throw new Error('Your user has no assigned warehouse. Contact your administrator.');
            }
            return loadStockAt(context, material.ID, dashboard.homeWarehouseID);
        })
        .then(function (stockRow) {
            s.flow.localStock = stockRow; // null = no stock record here (0 available)
            s.flow.lastRefreshedAt = new Date().toISOString();
            s.flow.stale = false;
            if (recordHistory) {
                // Best-effort; ignore failures so history never blocks scanning.
                recordScan(context, material.ID).catch(function () { /* ignored */ });
            }
            return context.executeAction('/mdk/Actions/Navigation/NavToMaterialDetails.action');
        })
        .catch(function (err) {
            return showMessage(context, errorMessage(err), 'Could not open material');
        });
}

/** Refreshes local availability for the current material; keeps old data marked stale on failure. */
export function refreshLocalAvailability(context) {
    const s = getSession();
    const f = s.flow;
    if (!f.material || !s.dashboard || !s.dashboard.homeWarehouseID) {
        return Promise.resolve(null);
    }
    return loadStockAt(context, f.material.ID, s.dashboard.homeWarehouseID)
        .then(function (stockRow) {
            f.localStock = stockRow;
            f.lastRefreshedAt = new Date().toISOString();
            f.stale = false;
            return stockRow;
        })
        .catch(function () {
            f.stale = true; // keep previously loaded data, but label it
            return null;
        });
}

/** Available quantity at the home warehouse for the current flow material. */
export function localAvailable() {
    const f = getSession().flow;
    if (!f.localStock) { return 0; }
    const a = f.localStock.availableQuantity;
    return a === null || a === undefined ? 0 : a;
}

/** The currently selected source row (or null). */
export function selectedSource() {
    const f = getSession().flow;
    if (!f.selectedSourceID) { return null; }
    for (let i = 0; i < f.sources.length; i++) {
        if (f.sources[i].warehouse_ID === f.selectedSourceID) { return f.sources[i]; }
    }
    return null;
}

export default function Flow() {
    return '';
}
