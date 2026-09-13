/**
 * Opens the supported native camera scanner (Action.Type.OpenBarcodeScanner)
 * after checking prerequisites. Cancellation is silent; denied camera
 * permission or missing camera gets a clear message with the manual-entry
 * fallback. The camera UI is owned by the MDK client and is released by it
 * when the scanner closes.
 */
import { getSession } from '../Shared/Session';
import { unwrapActionResult } from '../Shared/Format';
import { showMessage, loc } from '../Shared/Ui';
import { processScanValue } from './ProcessScan';
import { MATERIAL_CODE_PATTERN } from '../Shared/Config';

export default function OpenScanner(context) {
    const s = getSession();
    if (s.scanInFlight) { return Promise.resolve(); }

    return context.executeAction('/mdk/Actions/Scanner/CheckScannerPrerequisite.action')
        .then(function (checkResult) {
            const ok = unwrapActionResult(checkResult);
            if (ok === false || ok === 'false') {
                return showMessage(context, loc(context, 'scan_noCamera'), loc(context, 'scan_noCameraTitle'));
            }
            return context.executeAction('/mdk/Actions/Scanner/OpenScanner.action')
                .then(function (scanResult) {
                    const value = unwrapActionResult(scanResult);
                    const text = value === undefined || value === null ? '' : String(value).trim();
                    if (!text) { return; } // closed without a scan
                    if (!MATERIAL_CODE_PATTERN.test(text)) {
                        // Cancellation and reader errors surface as non-code text.
                        if (text.length > 40 || text.indexOf(' ') >= 0 || text.indexOf('://') >= 0) {
                            return showMessage(context, loc(context, 'scan_invalidFormat'), loc(context, 'scan_invalidTitle'));
                        }
                    }
                    return processScanValue(context, text);
                })
                .catch(function () {
                    // User cancelled the scanner - no message needed.
                });
        })
        .catch(function () {
            return showMessage(context, loc(context, 'scan_noCamera'), loc(context, 'scan_noCameraTitle'));
        });
}
