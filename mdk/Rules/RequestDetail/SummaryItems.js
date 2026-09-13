import { getSession } from '../Shared/Session';
import { materialImage, formatQty, statusLabel, statusStyle, formatDateTime } from '../Shared/Format';

/** Request summary card: material, quantity, route, status, created time, note. */
export default function SummaryItems() {
    const r = getSession().currentRequest;
    if (!r) { return []; }
    const m = r.material || {};
    const src = r.sourceWarehouse || {};
    const dst = r.destinationWarehouse || {};
    const rows = [{
        key: 'summary',
        image: materialImage(m.imagePath),
        title: (m.materialCode || '') + ' - ' + (m.name || ''),
        subhead: formatQty(r.quantity, m.baseUnit) + '  from ' + (src.name || '') + ' to ' + (dst.name || ''),
        footnote: r.reference + ' - created ' + formatDateTime(r.createdAt),
        status: statusLabel(r.status),
        statusStyle: statusStyle(r.status)
    }];
    if (r.note) {
        rows.push({
            key: 'note',
            title: 'Note',
            desc: r.note,
            status: '',
            statusStyle: 'wl-muted'
        });
    }
    return rows;
}
