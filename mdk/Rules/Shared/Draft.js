/**
 * Persistent submission draft: keeps the idempotency key of an in-flight
 * submission attempt across app restarts, so retrying the SAME attempt after
 * a crash or timeout can never create a duplicate request.
 *
 * Uses the documented NativeScript ApplicationSettings module exposed to MDK
 * rules (context.nativescript.appSettingsModule). All access is guarded -
 * on hosts without it (e.g. web preview) drafts silently degrade to
 * session-only behavior.
 */
const DRAFT_KEY = 'wl.submissionDraft';

function settings(context) {
    try {
        return context.nativescript && context.nativescript.appSettingsModule
            ? context.nativescript.appSettingsModule
            : null;
    } catch (e) {
        return null;
    }
}

export function loadDraft(context) {
    const s = settings(context);
    if (!s) { return null; }
    try {
        const raw = s.getString(DRAFT_KEY, '');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

export function saveDraft(context, draft) {
    const s = settings(context);
    if (!s) { return; }
    try {
        s.setString(DRAFT_KEY, JSON.stringify(draft));
        if (typeof s.flush === 'function') { s.flush(); }
    } catch (e) { /* best effort */ }
}

export function clearDraft(context) {
    const s = settings(context);
    if (!s) { return; }
    try {
        s.remove(DRAFT_KEY);
        if (typeof s.flush === 'function') { s.flush(); }
    } catch (e) { /* best effort */ }
}

/** Stable fingerprint of a submission payload for draft matching. */
export function draftFingerprint(payload) {
    return [
        String(payload.materialID || '').toLowerCase(),
        String(payload.sourceWarehouseID || '').toLowerCase(),
        String(payload.destinationWarehouseID || '').toLowerCase(),
        String(payload.quantity),
        String(payload.note || '')
    ].join('|');
}

export default function Draft() {
    return '';
}
