import { getSession } from '../Shared/Session';
import { loadRequestDetail } from '../Shared/Data';
import { redrawPage, showMessage, loc } from '../Shared/Ui';

/**
 * Loads the PERSISTED request (with its events) from the backend - the
 * confirmation view renders exactly what the server stored, never a
 * hardcoded reference.
 */
export default function DetailLoad(context) {
    const s = getSession();
    if (!s.currentRequestID) {
        return Promise.resolve();
    }
    return loadRequestDetail(context, s.currentRequestID)
        .then(function (row) {
            s.currentRequest = row;
            redrawPage(context, 'RequestDetail');
            if (!row) {
                return showMessage(context, loc(context, 'detail_notFound'));
            }
        })
        .catch(function (err) {
            s.currentRequest = null;
            redrawPage(context, 'RequestDetail');
            const msg = String(err && err.message ? err.message : err);
            return showMessage(context, loc(context, 'detail_loadError') + '\n\n' + msg);
        });
}
