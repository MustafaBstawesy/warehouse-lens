import { getSession } from '../Shared/Session';
import { ctrl, setCtrlValue } from '../Shared/Ui';

const MAX_NOTE = 200;

/** Stores the note, updates the live character counter, resets the attempt key on edit. */
export default function NoteChanged(context) {
    const f = getSession().flow;
    let v = '';
    try {
        const raw = context.getValue();
        v = raw === undefined || raw === null ? '' : String(raw);
    } catch (e) { v = ''; }

    if (f.form.note !== v) {
        f.form.note = v;
        f.form.idempotencyKey = null;
    }
    const counter = ctrl(context, 'Review', 'NoteCounter');
    const over = v.length > MAX_NOTE;
    setCtrlValue(counter, v.length + '/' + MAX_NOTE + (over ? ' - too long' : ''));
}
