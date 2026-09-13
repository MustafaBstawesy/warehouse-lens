import { getSession } from '../Shared/Session';

export default function NoteCounterValue() {
    const note = getSession().flow.form.note || '';
    return note.length + '/200';
}
