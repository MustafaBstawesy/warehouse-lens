import { getSession } from '../Shared/Session';
import { selectedSource } from '../Shared/Flow';
import { showToast, loc } from '../Shared/Ui';

const DEFAULT_DEMO_QUANTITY = 20;

/**
 * Continue to Review. Requires a selection. The default quantity is 20
 * where availability permits (demo default), otherwise the available amount.
 * A quantity from an earlier visit is preserved.
 */
export default function ContinuePress(context) {
    const f = getSession().flow;
    const src = selectedSource();
    if (!src) {
        return showToast(context, loc(context, 'findstock_selectFirst'));
    }
    if (f.form.quantity === null || f.form.quantity === undefined) {
        const available = src.availableQuantity || 0;
        f.form.quantity = Math.max(1, Math.min(DEFAULT_DEMO_QUANTITY, available));
    }
    return context.executeAction('/mdk/Actions/Navigation/NavToReview.action');
}
