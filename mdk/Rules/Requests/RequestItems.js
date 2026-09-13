import { getSession } from '../Shared/Session';
import { formatQty, relativeTime, statusLabel, statusStyle } from '../Shared/Format';

/** Request list rows: reference, material, quantity, route, status, age. */
export default function RequestItems() {
    const s = getSession();
    return (s.requests || []).map(function (r) {
        const m = r.material || {};
        const src = r.sourceWarehouse || {};
        const dst = r.destinationWarehouse || {};
        return {
            key: r.ID,
            title: r.reference + ' - ' + (m.materialCode || ''),
            subhead: formatQty(r.quantity, m.baseUnit) + ' - ' + (src.code || '') + ' to ' + (dst.code || ''),
            footnote: relativeTime(r.createdAt),
            status: statusLabel(r.status),
            statusStyle: statusStyle(r.status),
            accessory: 'disclosureIndicator'
        };
    });
}
