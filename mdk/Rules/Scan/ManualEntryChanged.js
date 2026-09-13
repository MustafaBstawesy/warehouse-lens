/**
 * Manual entry / keyboard-wedge path. Proven idioms: read the changed value,
 * clear the field synchronously BEFORE async work (the programmatic clear
 * re-fires OnValueChange with an empty value, which is ignored), and chain
 * scans strictly in arrival order.
 */
import { ctrl, setCtrlValue } from '../Shared/Ui';
import { processScanValue } from './ProcessScan';

let entryChain = Promise.resolve();

export default function ManualEntryChanged(context) {
    let raw = '';
    try {
        const v = context.getValue();
        raw = v === undefined || v === null ? '' : String(v).trim();
    } catch (e) {
        raw = '';
    }
    const field = ctrl(context, 'Scan', 'ManualEntry');
    if (!raw && field) {
        try {
            const cv = field.getValue();
            raw = cv === undefined || cv === null ? '' : String(cv).trim();
        } catch (e) {
            raw = '';
        }
    }
    if (!raw) { return; }

    setCtrlValue(field, '');

    entryChain = entryChain
        .then(function () {
            return processScanValue(context, raw);
        })
        .catch(function () {
            // keep the chain alive for the next entry
        });
    return entryChain;
}
