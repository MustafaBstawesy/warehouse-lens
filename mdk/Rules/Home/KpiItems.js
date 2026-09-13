import { getSession } from '../Shared/Session';

/**
 * Dashboard counters, always derived from service data (getDashboard()).
 * Low stock = available quantity at or below the reorder point, active
 * materials at the user's home warehouse.
 */
export default function KpiItems() {
    const s = getSession();
    const d = s.dashboard;
    const pending = d ? String(d.pendingCount) : '-';
    const lowStock = d ? String(d.lowStockCount) : '-';
    const homeName = d && d.homeWarehouseName ? d.homeWarehouseName : 'your warehouse';
    return [
        {
            key: 'pending',
            title: 'Pending requests',
            subhead: 'Transfer requests awaiting approval',
            status: pending,
            statusStyle: 'wl-kpi-value',
            accessory: 'disclosureIndicator'
        },
        {
            key: 'lowstock',
            title: 'Low-stock materials',
            subhead: 'At or below reorder point at ' + homeName,
            status: lowStock,
            statusStyle: 'wl-kpi-warn',
            accessory: 'none'
        }
    ];
}
