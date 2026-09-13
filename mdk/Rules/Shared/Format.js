/**
 * Formatting and result-normalization helpers (patterns proven on device
 * in the reference project).
 */

/** Convert an MDK read() result (DataQueryResult or array) to a JS array. */
export function toArray(result) {
    if (!result) { return []; }
    if (Array.isArray(result)) { return result; }
    const arr = [];
    if (typeof result.length === 'number' && typeof result.getItem === 'function') {
        for (let i = 0; i < result.length; i++) { arr.push(result.getItem(i)); }
        return arr;
    }
    try {
        for (const row of result) { arr.push(row); }
    } catch (e) { /* not iterable - fall through */ }
    return arr;
}

/** Unwrap an executeAction / OData V4 action result into plain data. */
export function unwrapActionResult(result) {
    let data = result;
    if (data && data.data !== undefined) { data = data.data; }
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return data; }
    }
    if (data && data.value !== undefined && (typeof data.value === 'string' || typeof data.value === 'object')) {
        data = data.value;
    }
    return data;
}

/** Best-effort extraction of a human-readable message from any error shape. */
export function errorMessage(err) {
    if (!err) { return 'Unknown error'; }
    let text = '';
    if (typeof err === 'string') { text = err; }
    else if (err.message) { text = String(err.message); }
    else { text = String(err); }
    // OData error bodies often travel embedded in the message text.
    const m = text.match(/"message"\s*:\s*"([^"]+)"/);
    if (m && m[1]) { return m[1]; }
    return text;
}

/** True when the error text carries the given backend error code. */
export function hasErrorCode(err, code) {
    const text = (err && err.message) ? String(err.message) : String(err || '');
    return text.indexOf(code) >= 0;
}

/** "5m ago" / "3h ago" / "2d ago" / date for older. */
export function relativeTime(iso) {
    if (!iso) { return ''; }
    const then = new Date(iso).getTime();
    if (isNaN(then)) { return ''; }
    const diff = Date.now() - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) { return 'just now'; }
    if (minutes < 60) { return minutes + 'm ago'; }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) { return hours + 'h ago'; }
    const days = Math.floor(hours / 24);
    if (days < 7) { return days + 'd ago'; }
    return formatDateTime(iso, true);
}

/** "12 Sep 2026, 14:05" (or date only). */
export function formatDateTime(iso, dateOnly) {
    if (!iso) { return ''; }
    const d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const date = d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    if (dateOnly) { return date; }
    const hh = ('0' + d.getHours()).slice(-2);
    const mm = ('0' + d.getMinutes()).slice(-2);
    return date + ', ' + hh + ':' + mm;
}

/** "240 EA" quantity with unit. */
export function formatQty(quantity, unit) {
    const q = (quantity === null || quantity === undefined) ? 0 : quantity;
    return String(q) + ' ' + (unit || '');
}

/** Escape a string literal for use inside an OData $filter (data, never code). */
export function escapeODataLiteral(value) {
    return String(value || '').replace(/'/g, "''");
}

/** Map a material imagePath from the service to a bundled client image. */
export function materialImage(imagePath) {
    const known = { 'mat-1042.png': '/mdk/Images/mat-1042.png' };
    if (imagePath && known[imagePath]) { return known[imagePath]; }
    return '/mdk/Images/mat-generic.png';
}

/** Human label for a request status (always text, never color alone). */
export function statusLabel(status) {
    switch (status) {
        case 'AWAITING_APPROVAL': return 'Awaiting approval';
        case 'APPROVED': return 'Approved';
        case 'DISPATCHED': return 'Dispatched';
        case 'RECEIVED': return 'Received';
        case 'REJECTED': return 'Rejected';
        default: return String(status || '');
    }
}

/** Style class for a request status badge. */
export function statusStyle(status) {
    switch (status) {
        case 'AWAITING_APPROVAL': return 'wl-status-pending';
        case 'APPROVED': return 'wl-status-approved';
        case 'DISPATCHED': return 'wl-status-dispatched';
        case 'RECEIVED': return 'wl-status-received';
        case 'REJECTED': return 'wl-status-rejected';
        default: return 'wl-status-pending';
    }
}

/** Availability badge text + style for a stock row. */
export function availabilityBadge(available, reorderPoint, unit) {
    const a = available === null || available === undefined ? 0 : available;
    if (a <= 0) {
        return { text: 'Out of stock here', style: 'wl-badge-out' };
    }
    if (reorderPoint !== undefined && reorderPoint !== null && a <= reorderPoint) {
        return { text: 'Low stock - ' + formatQty(a, unit), style: 'wl-badge-low' };
    }
    return { text: 'In stock - ' + formatQty(a, unit), style: 'wl-badge-ok' };
}

export default function Format() {
    return '';
}
