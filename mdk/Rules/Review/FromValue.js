import { selectedSource } from '../Shared/Flow';

export default function FromValue() {
    const src = selectedSource();
    return src ? src.warehouseName + ' (' + src.warehouseCode + ')' : '';
}
