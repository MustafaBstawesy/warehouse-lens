import { getSession } from '../Shared/Session';
import { showToast, loc, pressedRow } from '../Shared/Ui';

/** Pending -> filtered Requests list; low stock -> informative summary. */
export default function KpiPress(context) {
    const row = pressedRow(context);
    const s = getSession();
    if (row.key === 'pending') {
        s.requestsFilter = 'AWAITING_APPROVAL';
        s.requestsSearch = '';
        return context.executeAction('/mdk/Actions/Navigation/NavToRequests.action');
    }
    const d = s.dashboard;
    const count = d ? d.lowStockCount : 0;
    const home = d && d.homeWarehouseName ? d.homeWarehouseName : 'your warehouse';
    return showToast(context, loc(context, 'home_lowStockToast', [String(count), home]));
}
