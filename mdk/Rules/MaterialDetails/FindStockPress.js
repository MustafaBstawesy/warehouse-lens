import { getSession } from '../Shared/Session';
import { loadSources } from '../Shared/Data';
import { showMessage, loc } from '../Shared/Ui';
import { errorMessage } from '../Shared/Format';

/**
 * Primary action: load availability at OTHER active warehouses (sorted by
 * available quantity, destination excluded) and open the Find Stock page.
 */
export default function FindStockPress(context) {
    const s = getSession();
    const f = s.flow;
    if (!f.material) { return Promise.resolve(); }
    if (!f.material.active) {
        return showMessage(context, loc(context, 'details_inactiveMaterial'));
    }
    if (!s.dashboard || !s.dashboard.homeWarehouseID) {
        return showMessage(context, loc(context, 'generic_noWarehouse'));
    }
    return loadSources(context, f.material.ID, s.dashboard.homeWarehouseID)
        .then(function (rows) {
            f.sources = rows;
            // Keep a previous selection only if that warehouse is still eligible.
            if (f.selectedSourceID) {
                let stillThere = false;
                for (let i = 0; i < rows.length; i++) {
                    if (rows[i].warehouse_ID === f.selectedSourceID) { stillThere = true; break; }
                }
                if (!stillThere) { f.selectedSourceID = null; }
            }
            return context.executeAction('/mdk/Actions/Navigation/NavToFindStock.action');
        })
        .catch(function (err) {
            return showMessage(context, loc(context, 'findstock_loadError') + '\n\n' + errorMessage(err));
        });
}
