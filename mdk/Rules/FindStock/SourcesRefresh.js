import { getSession } from '../Shared/Session';
import { loadSources } from '../Shared/Data';
import { redrawPage, showToast, loc } from '../Shared/Ui';

/**
 * OnLoaded / OnReturning: refresh source availability. A still-eligible
 * previous selection is preserved; a vanished one is cleared.
 */
export default function SourcesRefresh(context) {
    const s = getSession();
    const f = s.flow;
    if (!f.material || !s.dashboard || !s.dashboard.homeWarehouseID) {
        return Promise.resolve();
    }
    return loadSources(context, f.material.ID, s.dashboard.homeWarehouseID)
        .then(function (rows) {
            f.sources = rows;
            if (f.selectedSourceID) {
                let stillThere = false;
                for (let i = 0; i < rows.length; i++) {
                    if (rows[i].warehouse_ID === f.selectedSourceID) { stillThere = true; break; }
                }
                if (!stillThere) { f.selectedSourceID = null; }
            }
            redrawPage(context, 'FindStock');
        })
        .catch(function () {
            redrawPage(context, 'FindStock');
            return showToast(context, loc(context, 'findstock_refreshFailed'));
        });
}
