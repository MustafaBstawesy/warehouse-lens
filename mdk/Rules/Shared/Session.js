/**
 * Shared client session state.
 *
 * MDK bundles all rules with webpack, so this module is instantiated exactly
 * once per client session; every rule that imports it shares the same object
 * (same pattern proven in the reference project). Temporary flow state lives
 * here; everything that must survive an app restart is persisted on the
 * backend (requests, recent scans) or in application settings (in-flight
 * submission draft - see Review/SubmitPress.js and Shared/Draft.js).
 */
function freshFlow() {
    return {
        // Scan -> Material -> Find stock -> Review flow state
        material: null,          // { ID, materialCode, name, description, baseUnit, imagePath, active }
        localStock: null,        // StockAvailability row at the home warehouse (or null)
        lastRefreshedAt: null,   // ISO timestamp of the last successful availability load
        stale: false,            // true when the last refresh failed and old data is shown
        sources: [],             // StockAvailability rows at other warehouses
        selectedSourceID: null,
        form: {
            quantity: null,      // number; defaulted on Review entry
            note: '',
            idempotencyKey: null // kept across retries of the SAME attempt; cleared on edit
        },
        submitting: false,
        lastSubmit: null         // SubmitResult of the confirmed submission
    };
}

function freshSession() {
    return {
        initialized: false,      // OData service initialized
        dashboard: null,         // getDashboard() result
        recentScans: [],
        requests: [],
        requestsFilter: 'ALL',
        requestsSearch: '',
        requestsError: false,
        currentRequestID: null,  // request shown on RequestDetail
        justSubmitted: false,    // RequestDetail doubles as the confirmation page
        scanInFlight: false,     // prevents duplicate scanner callbacks
        flow: freshFlow()
    };
}

const store = { s: freshSession() };

export function getSession() {
    if (!store.s) { store.s = freshSession(); }
    return store.s;
}

/** Clears the transfer-request flow only (after confirmed success). */
export function resetFlow() {
    const s = getSession();
    s.flow = freshFlow();
    return s;
}

/** Full reset (fresh launch / logout). */
export function resetAll() {
    store.s = freshSession();
    return store.s;
}

export default function Session() {
    return getSession();
}
