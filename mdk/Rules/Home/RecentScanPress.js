import { getSession } from '../Shared/Session';
import { openMaterial } from '../Shared/Flow';
import { showMessage, pressedRow } from '../Shared/Ui';

/** Opens material details for a recent scan (no new history entry). */
export default function RecentScanPress(context) {
    const row = pressedRow(context);
    const scans = getSession().recentScans || [];
    for (let i = 0; i < scans.length; i++) {
        if (scans[i].material && scans[i].material.ID === row.key) {
            return openMaterial(context, scans[i].material, false);
        }
    }
    return showMessage(context, 'This material is no longer available.');
}
