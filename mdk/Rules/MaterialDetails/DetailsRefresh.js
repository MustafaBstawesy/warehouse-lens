import { refreshLocalAvailability } from '../Shared/Flow';
import { redrawPage } from '../Shared/Ui';

/** OnLoaded / OnReturning: refresh availability; failures label data stale. */
export default function DetailsRefresh(context) {
    return refreshLocalAvailability(context).then(function () {
        redrawPage(context, 'MaterialDetails');
    });
}
