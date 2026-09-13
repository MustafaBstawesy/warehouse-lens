import { getSession } from '../Shared/Session';
import { formatQty } from '../Shared/Format';

/**
 * Source warehouse cards, sorted by available quantity descending (server
 * ordering). No invented distances or "nearest" ranking. The selected card
 * carries a checkmark accessory and a selected style.
 */
export default function SourceItems() {
    const f = getSession().flow;
    const m = f.material;
    if (!m) { return []; }
    return (f.sources || []).map(function (row) {
        const selected = row.warehouse_ID === f.selectedSourceID;
        return {
            key: row.warehouse_ID,
            title: row.warehouseName,
            subhead: (row.warehouseCity || '') + ' - ' + (row.warehouseCode || ''),
            status: formatQty(row.availableQuantity, m.baseUnit),
            statusStyle: selected ? 'wl-qty-selected' : 'wl-qty',
            footnote: selected ? 'Selected source' : '',
            accessory: selected ? 'checkmark' : 'none'
        };
    });
}
