import { getSession } from '../Shared/Session';
import RequestsLoad from './RequestsLoad';

/** Applies a new status filter (ListPicker value shapes vary - be tolerant). */
export default function FilterChanged(context) {
    let v = null;
    try { v = context.getValue(); } catch (e) { v = null; }
    if (Array.isArray(v)) { v = v.length > 0 ? v[0] : null; }
    if (v && typeof v === 'object' && v.ReturnValue !== undefined) { v = v.ReturnValue; }
    const filter = v ? String(v) : 'ALL';

    const s = getSession();
    if (s.requestsFilter === filter) { return; }
    s.requestsFilter = filter;
    return RequestsLoad(context);
}
