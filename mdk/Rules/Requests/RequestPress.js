import { getSession } from '../Shared/Session';
import { pressedRow } from '../Shared/Ui';

/** Opens the shared request-detail component for the pressed request. */
export default function RequestPress(context) {
    const row = pressedRow(context);
    if (!row.key) { return; }
    const s = getSession();
    s.currentRequestID = row.key;
    s.justSubmitted = false;
    return context.executeAction('/mdk/Actions/Navigation/NavToRequestDetail.action');
}
