import { getSession } from '../Shared/Session';

/** Preserved note text (survives back navigation from Review). */
export default function NoteDefault() {
    return getSession().flow.form.note || '';
}
