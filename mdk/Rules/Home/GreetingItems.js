import { getSession } from '../Shared/Session';
import { DEMO_MODE } from '../Shared/Config';

function greetingWord() {
    const h = new Date().getHours();
    if (h < 12) { return 'Good morning'; }
    if (h < 18) { return 'Good afternoon'; }
    return 'Good evening';
}

/** Single hero row: greeting, current warehouse, demo-data indicator. */
export default function GreetingItems() {
    const s = getSession();
    const d = s.dashboard;
    const name = d && d.userDisplayName ? d.userDisplayName : (DEMO_MODE ? 'Alex' : '');
    const warehouse = d && d.homeWarehouseName
        ? d.homeWarehouseName + ' - ' + (d.homeWarehouseCode || '')
        : (s.dashboardError ? 'Connection needed for live data' : 'Loading...');
    return [{
        title: name ? greetingWord() + ', ' + name : greetingWord(),
        subhead: warehouse,
        status: DEMO_MODE ? 'DEMO DATA' : '',
        statusStyle: 'wl-demo-badge'
    }];
}
