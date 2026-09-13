import { getSession } from '../Shared/Session';
import { localAvailable } from '../Shared/Flow';
import { materialImage, availabilityBadge } from '../Shared/Format';

/** Hero row: product image, name, code, availability badge, description. */
export default function HeroItems() {
    const f = getSession().flow;
    const m = f.material;
    if (!m) { return []; }
    const reorderPoint = f.localStock ? f.localStock.reorderPoint : null;
    const badge = m.active
        ? availabilityBadge(localAvailable(), reorderPoint, m.baseUnit)
        : { text: 'Inactive material', style: 'wl-badge-out' };
    return [{
        image: materialImage(m.imagePath),
        title: m.name,
        subhead: m.materialCode,
        desc: m.description || '',
        status: badge.text,
        statusStyle: badge.style
    }];
}
