import { getSession } from '../Shared/Session';
import { localAvailable } from '../Shared/Flow';
import { materialImage, formatQty } from '../Shared/Format';

/** Compact material summary at the top of Find Stock. */
export default function SummaryItems() {
    const s = getSession();
    const m = s.flow.material;
    if (!m) { return []; }
    const home = s.dashboard && s.dashboard.homeWarehouseName ? s.dashboard.homeWarehouseName : 'here';
    return [{
        image: materialImage(m.imagePath),
        title: m.name,
        subhead: m.materialCode,
        footnote: formatQty(localAvailable(), m.baseUnit) + ' available at ' + home
    }];
}
