import { getSession } from '../Shared/Session';
import { refreshLocalAvailability } from '../Shared/Flow';
import { redrawPage, showToast, loc } from '../Shared/Ui';

/** Explicit refresh from the action bar, with clear stale feedback. */
export default function RefreshPress(context) {
    return refreshLocalAvailability(context).then(function () {
        redrawPage(context, 'MaterialDetails');
        const stale = getSession().flow.stale;
        return showToast(context, loc(context, stale ? 'details_refreshFailed' : 'details_refreshed'));
    });
}
