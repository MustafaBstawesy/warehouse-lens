import { getSession } from '../Shared/Session';
import { loadDashboard, loadRecentScans } from '../Shared/Data';
import { redrawPage, showMessage, loc } from '../Shared/Ui';
import { errorMessage } from '../Shared/Format';

/**
 * Loads dashboard counts and recent scans, then redraws. Counts are always
 * derived from live service data. On failure the page shows its offline
 * hint, and the dialog carries the real error text so a failing backend,
 * login or destination can be diagnosed on the device itself.
 */
export default function HomeLoaded(context) {
    const s = getSession();
    return loadDashboard(context)
        .then(function () {
            return loadRecentScans(context);
        })
        .then(function () {
            s.dashboardError = false;
            redrawPage(context, 'Home');
        })
        .catch(function (err) {
            s.dashboardError = true;
            redrawPage(context, 'Home');
            return showMessage(context,
                loc(context, 'home_offlineHint') + '\n\nDetails: ' + errorMessage(err),
                loc(context, 'generic_errorTitle'));
        });
}
