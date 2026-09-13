/**
 * Submits the transfer request.
 *
 * Guarantees implemented here (server enforces its own copies of all of them):
 *  - double-tap protection (submitting flag + modal activity indicator)
 *  - client-side validation before any network call
 *  - a PERSISTENT idempotency key per attempt (kept across retries and app
 *    restarts via application settings; reset whenever the payload is edited)
 *  - on failure the form keeps its values
 *  - on INSUFFICIENT_AVAILABILITY the latest availability is fetched and
 *    shown, and the user must revise the quantity
 *  - a timeout/uncertain response never creates a second request: the retry
 *    reuses the same key and the server replays the original result
 *  - success is only shown after the backend confirms persistence
 */
import { getSession, resetFlow } from '../Shared/Session';
import { selectedSource } from '../Shared/Flow';
import { submitTransferRequest, loadSources } from '../Shared/Data';
import { loadDraft, saveDraft, clearDraft, draftFingerprint } from '../Shared/Draft';
import { showMessage, redrawPage, loc } from '../Shared/Ui';
import { errorMessage, hasErrorCode } from '../Shared/Format';

const MAX_NOTE = 200;

function newKey() {
    const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    return 'mdk-' + Date.now().toString(36) + '-' + rand;
}

export default function SubmitPress(context) {
    const s = getSession();
    const f = s.flow;
    if (f.submitting) { return Promise.resolve(); }

    const src = selectedSource();
    const m = f.material;
    const d = s.dashboard;
    if (!m || !src || !d || !d.homeWarehouseID) {
        return showMessage(context, loc(context, 'review_missingContext'));
    }

    // --- client-side validation (server revalidates everything) -----------
    const quantity = f.form.quantity;
    if (typeof quantity !== 'number' || !isFinite(quantity) || quantity % 1 !== 0 || quantity <= 0) {
        return showMessage(context, loc(context, 'review_invalidQuantity'));
    }
    const available = src.availableQuantity || 0;
    if (quantity > available) {
        return showMessage(context, loc(context, 'review_overAvailability', [String(available), m.baseUnit]));
    }
    const note = (f.form.note || '').trim();
    if (note.length > MAX_NOTE) {
        return showMessage(context, loc(context, 'review_noteTooLong'));
    }

    const payload = {
        materialID: m.ID,
        sourceWarehouseID: src.warehouse_ID,
        destinationWarehouseID: d.homeWarehouseID,
        quantity: quantity,
        note: note.length > 0 ? note : '',
        idempotencyKey: ''
    };

    // --- persistent idempotency key per attempt ----------------------------
    const fingerprint = draftFingerprint(payload);
    if (!f.form.idempotencyKey) {
        const draft = loadDraft(context);
        f.form.idempotencyKey = (draft && draft.fingerprint === fingerprint && draft.key)
            ? draft.key            // same attempt resumed after restart/timeout
            : newKey();            // new attempt
    }
    payload.idempotencyKey = f.form.idempotencyKey;
    saveDraft(context, { key: payload.idempotencyKey, fingerprint: fingerprint });

    f.submitting = true;
    return submitTransferRequest(context, payload)
        .then(function (result) {
            if (!result || !result.ID) {
                throw new Error(loc(context, 'review_uncertain'));
            }
            // Confirmed persisted: clear the temporary form state and draft.
            clearDraft(context);
            s.currentRequestID = result.ID;
            s.justSubmitted = true;
            resetFlow();
            return context.executeAction('/mdk/Actions/Navigation/NavToRequestDetailAfterSubmit.action');
        })
        .catch(function (err) {
            f.submitting = false;
            const details = errorMessage(err);

            if (hasErrorCode(err, 'INSUFFICIENT_AVAILABILITY')) {
                // Show latest availability and require a revision. The key is
                // kept; editing the quantity starts a new attempt anyway.
                return loadSources(context, m.ID, d.homeWarehouseID)
                    .then(function (rows) {
                        f.sources = rows;
                        redrawPage(context, 'Review');
                    })
                    .catch(function () { /* keep old rows */ })
                    .then(function () {
                        return showMessage(context, details, loc(context, 'review_stockChangedTitle'));
                    });
            }
            if (hasErrorCode(err, 'IDEMPOTENCY_CONFLICT')) {
                f.form.idempotencyKey = null;
                clearDraft(context);
                return showMessage(context, details, loc(context, 'generic_errorTitle'));
            }
            // Network failure / timeout / unknown: values are preserved and the
            // SAME key will be reused, so retrying cannot create a duplicate.
            return showMessage(context,
                loc(context, 'review_submitFailed') + '\n\n' + details,
                loc(context, 'generic_errorTitle'));
        });
}
