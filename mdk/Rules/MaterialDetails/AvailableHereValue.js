import { getSession } from '../Shared/Session';
import { localAvailable } from '../Shared/Flow';
import { formatQty } from '../Shared/Format';

/** "0 EA" - available at the user's home warehouse (onHand - reserved). */
export default function AvailableHereValue() {
    const f = getSession().flow;
    if (!f.material) { return ''; }
    return formatQty(localAvailable(), f.material.baseUnit);
}
