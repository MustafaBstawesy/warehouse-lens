import { selectedSource } from '../Shared/Flow';

/** Primary button label reflects the selection, e.g. "Select Alexandria". */
export default function ContinueTitle() {
    const src = selectedSource();
    if (!src) { return 'Select a warehouse'; }
    return 'Select ' + (src.warehouseCity || src.warehouseName);
}
