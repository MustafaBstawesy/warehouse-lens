import { processScanValue } from './ProcessScan';

/** Demo-mode shortcut: behaves exactly like scanning the MAT-1042 label. */
export default function UseDemoMaterial(context) {
    return processScanValue(context, 'MAT-1042');
}
