import { getSession } from '../Shared/Session';
import { relativeTime } from '../Shared/Format';

/** Last successful availability refresh; stale data is labeled as such. */
export default function LastRefreshedValue() {
    const f = getSession().flow;
    if (!f.lastRefreshedAt) { return f.stale ? 'Refresh failed' : ''; }
    const base = relativeTime(f.lastRefreshedAt);
    return f.stale ? base + ' - STALE, refresh failed' : base;
}
