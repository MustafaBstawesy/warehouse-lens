import { getSession } from '../Shared/Session';
import { loadRequests } from '../Shared/Data';
import { redrawSection, showToast, loc } from '../Shared/Ui';

/**
 * Loads the (server-filtered) request list for the current filter + search.
 * Only the list section is redrawn so the search/filter form keeps its
 * on-screen values.
 */
export default function RequestsLoad(context) {
    const s = getSession();
    s.justSubmitted = false; // leaving any confirmation context
    s.requestsError = false;
    return loadRequests(context, s.requestsFilter, s.requestsSearch)
        .then(function (rows) {
            s.requests = rows;
            redrawSection(context, 'Requests', 'RequestListSection');
        })
        .catch(function () {
            s.requestsError = true;
            s.requests = [];
            redrawSection(context, 'Requests', 'RequestListSection');
            return showToast(context, loc(context, 'requests_loadError'));
        });
}
