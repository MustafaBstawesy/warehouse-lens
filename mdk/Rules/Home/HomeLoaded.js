import { getSession } from '../Shared/Session';
import { loadDashboard, loadRecentScans } from '../Shared/Data';
import { redrawPage, showToast } from '../Shared/Ui';
import { loc } from '../Shared/Ui';

/**
 * Loads dashboard counts and recent scans, then redraws. Counts are always
 * derived from live service data; on failure the page shows its offline
 * hint and keeps working for retry via pull-back-navigation or relaunch.
 */
export default function HomeLoaded(context) {
    const s = getSession();
    return Promise.all([
        loadDashboard(context),
        loadRecentScans(context)
    ])
        .then(function () {
            s.dashboardError = false;
            redrawPage(context, 'Home');
        })
        .catch(function () {
            s.dashboardError = true;
            redrawPage(context, 'Home');
            return showToast(context, loc(context, 'home_offlineHint'));
        });
}
