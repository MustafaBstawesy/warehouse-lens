import { getSession } from '../Shared/Session';

/** Home warehouse display name. */
export default function WarehouseValue() {
    const d = getSession().dashboard;
    if (!d || !d.homeWarehouseName) { return ''; }
    return d.homeWarehouseName + ' (' + (d.homeWarehouseCode || '') + ')';
}
