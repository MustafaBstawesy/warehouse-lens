import { getSession } from '../Shared/Session';
import { selectedSource } from '../Shared/Flow';
import { formatQty } from '../Shared/Format';

export default function AvailableAtSourceValue() {
    const src = selectedSource();
    const m = getSession().flow.material;
    if (!src || !m) { return ''; }
    return formatQty(src.availableQuantity, m.baseUnit);
}
