/**
 * UI helpers (proven patterns from the reference project).
 */

/** Resolve a control proxy on a page: ctrl(context, 'Review', 'NoteCounter'). */
export function ctrl(context, pageName, controlName) {
    try {
        return context.evaluateTargetPath('#Page:' + pageName + '/#Control:' + controlName);
    } catch (e) {
        return undefined;
    }
}

/** Read a trimmed string value from a control proxy. */
export function ctrlValue(control) {
    if (!control) { return ''; }
    try {
        const v = control.getValue();
        return v === undefined || v === null ? '' : String(v).trim();
    } catch (e) { return ''; }
}

/** Set a control value, swallowing errors (control may not be on screen). */
export function setCtrlValue(control, value) {
    if (!control) { return; }
    try { control.setValue(value); } catch (e) { /* ignore */ }
}

/** Blocking modal message. */
export function showMessage(context, message, title) {
    const props = { Message: String(message) };
    if (title) { props.Title = String(title); }
    return context.executeAction({
        Name: '/mdk/Actions/Application/GenericMessage.action',
        Properties: props
    });
}

/** Non-blocking toast. */
export function showToast(context, message) {
    return context.executeAction({
        Name: '/mdk/Actions/Application/GenericToast.action',
        Properties: { Message: String(message) }
    });
}

/** Redraw a sectioned-table section bound to a rule target. */
export function redrawSection(context, pageName, sectionName) {
    try {
        const section = context.evaluateTargetPath('#Page:' + pageName + '/#Control:' + sectionName);
        if (section && typeof section.redraw === 'function') {
            section.redraw();
            return;
        }
    } catch (e) { /* fall through to page redraw */ }
    redrawPage(context, pageName);
}

/** Redraw a whole page (re-evaluates rule-valued properties). */
export function redrawPage(context, pageName) {
    try {
        const page = context.evaluateTargetPath('#Page:' + pageName);
        if (page && typeof page.redraw === 'function') {
            page.redraw();
        }
    } catch (e) { /* ignore */ }
}

/** Pressed-row binding for ObjectCell OnPress rules (device-proven fallback chain). */
export function pressedRow(context) {
    let row = context.binding;
    if (!row && typeof context.getPressedItem === 'function') {
        try {
            const pressed = context.getPressedItem();
            row = pressed && pressed.binding ? pressed.binding : pressed;
        } catch (e) {
            row = null;
        }
    }
    return row || {};
}

/** localizeText that survives missing keys. */
export function loc(context, key, params) {
    try {
        return context.localizeText(key, params || []);
    } catch (e) {
        return key;
    }
}

export default function Ui() {
    return '';
}
