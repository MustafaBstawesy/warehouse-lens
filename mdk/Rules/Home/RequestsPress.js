import { getSession } from '../Shared/Session';

/** Navigation: open the (unfiltered) Requests list. */
export default function RequestsPress(context) {
    const s = getSession();
    s.requestsFilter = 'ALL';
    s.requestsSearch = '';
    return context.executeAction('/mdk/Actions/Navigation/NavToRequests.action');
}
