import { getSession } from '../Shared/Session';
import { redrawPage, pressedRow } from '../Shared/Ui';

/** Selects a source warehouse card (single selection, clear selected state). */
export default function SourcePress(context) {
    const row = pressedRow(context);
    const f = getSession().flow;
    if (!row.key) { return; }
    if (f.selectedSourceID !== row.key) {
        f.selectedSourceID = row.key;
        // The source is part of the submission payload: changing it starts a
        // NEW attempt, so the idempotency key must not be reused.
        f.form.idempotencyKey = null;
    }
    redrawPage(context, 'FindStock');
}
