import { getSession } from '../Shared/Session';

/** From the confirmation view to the full requests list. */
export default function ViewRequestsPress(context) {
    const s = getSession();
    s.justSubmitted = false;
    s.requestsFilter = 'ALL';
    s.requestsSearch = '';
    return context.executeAction('/mdk/Actions/Navigation/NavToRequests.action');
}
