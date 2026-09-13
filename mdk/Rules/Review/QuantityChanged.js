import { getSession } from '../Shared/Session';

/**
 * Stores the stepper value. Editing the payload after a submission attempt
 * starts a NEW attempt: the idempotency key is cleared so the next submit
 * uses a fresh key.
 */
export default function QuantityChanged(context) {
    const f = getSession().flow;
    let v = null;
    try { v = context.getValue(); } catch (e) { v = null; }
    const parsed = typeof v === 'number' ? v : parseFloat(String(v));
    if (isNaN(parsed)) { return; }
    if (f.form.quantity !== parsed) {
        f.form.quantity = parsed;
        f.form.idempotencyKey = null;
    }
}
