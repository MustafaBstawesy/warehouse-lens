import { getSession } from '../Shared/Session';

export default function ToValue() {
    const d = getSession().dashboard;
    return d && d.homeWarehouseName ? d.homeWarehouseName + ' (' + (d.homeWarehouseCode || '') + ')' : '';
}
