/**
 * Shared scan processing: validates a scanned/typed value as PLAIN DATA
 * (never a URL, never executable content), resolves the material, records
 * history, and navigates to details. Serialized so rapid repeated scanner
 * callbacks can never open the details page twice.
 */
import { getSession } from '../Shared/Session';
import { MATERIAL_CODE_PATTERN } from '../Shared/Config';
import { findMaterialByCode } from '../Shared/Data';
import { openMaterial } from '../Shared/Flow';
import { showMessage, loc } from '../Shared/Ui';

export function processScanValue(context, raw) {
    const s = getSession();
    const value = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!value) { return Promise.resolve(); }

    if (s.scanInFlight) { return Promise.resolve(); }
    s.scanInFlight = true;

    if (!MATERIAL_CODE_PATTERN.test(value)) {
        s.scanInFlight = false;
        return showMessage(context, loc(context, 'scan_invalidFormat'), loc(context, 'scan_invalidTitle'));
    }
    const code = value.toUpperCase();

    return findMaterialByCode(context, code)
        .then(function (material) {
            if (!material) {
                s.scanInFlight = false;
                return showMessage(context, loc(context, 'scan_unknownMaterial', [code]), loc(context, 'scan_unknownTitle'));
            }
            return openMaterial(context, material, true)
                .then(function () { s.scanInFlight = false; });
        })
        .catch(function (err) {
            s.scanInFlight = false;
            const msg = String(err && err.message ? err.message : err);
            return showMessage(context, loc(context, 'scan_networkError') + '\n\n' + msg, loc(context, 'generic_errorTitle'));
        });
}

export default function ProcessScan() {
    return '';
}
