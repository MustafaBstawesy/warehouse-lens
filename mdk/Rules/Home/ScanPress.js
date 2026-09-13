/** Primary action: open the scanner page. */
export default function ScanPress(context) {
    return context.executeAction('/mdk/Actions/Navigation/NavToScan.action');
}
