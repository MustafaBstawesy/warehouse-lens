import { getSession } from '../Shared/Session';
import RequestsLoad from './RequestsLoad';

/** Search by reference or material code (server-side contains filter). */
export default function SearchChanged(context) {
    let v = '';
    try {
        const raw = context.getValue();
        v = raw === undefined || raw === null ? '' : String(raw).trim();
    } catch (e) { v = ''; }
    const s = getSession();
    if (s.requestsSearch === v) { return; }
    s.requestsSearch = v;
    return RequestsLoad(context);
}
