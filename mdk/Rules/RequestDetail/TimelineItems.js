import { getSession } from '../Shared/Session';
import { formatDateTime } from '../Shared/Format';

/**
 * Timeline derived from PERSISTED events + current status. Real timestamps
 * only; steps that have not happened are shown as pending, never completed.
 * Rejected requests get a clear alternate timeline.
 */
export default function TimelineItems() {
    const r = getSession().currentRequest;
    if (!r) { return []; }
    const events = Array.isArray(r.events) ? r.events : [];
    const byType = {};
    for (let i = 0; i < events.length; i++) {
        byType[events[i].eventType] = events[i];
    }

    function row(key, title, state, timestamp, message) {
        const styles = {
            done: 'wl-step-done',
            current: 'wl-step-current',
            pending: 'wl-step-pending',
            rejected: 'wl-step-rejected'
        };
        const labels = {
            done: 'Completed',
            current: 'Current',
            pending: 'Pending',
            rejected: 'Rejected'
        };
        return {
            key: key,
            title: title,
            subhead: timestamp ? formatDateTime(timestamp) : 'Not yet',
            footnote: message || '',
            status: labels[state],
            statusStyle: styles[state]
        };
    }

    const submitted = byType.SUBMITTED;
    const rows = [
        row('submitted', 'Submitted', 'done', submitted ? submitted.timestamp : r.createdAt,
            submitted ? submitted.message : '')
    ];

    if (r.status === 'REJECTED') {
        const rejected = byType.REJECTED;
        rows.push(row('rejected', 'Rejected', 'rejected', rejected ? rejected.timestamp : null,
            rejected ? rejected.message : ''));
        return rows;
    }

    const approved = byType.APPROVED;
    const dispatched = byType.DISPATCHED;
    const received = byType.RECEIVED;

    rows.push(row('approval', 'Awaiting approval',
        approved ? 'done' : 'current',
        approved ? approved.timestamp : null,
        approved ? approved.message : 'A supervisor must approve this request.'));

    rows.push(row('dispatch', 'Dispatch',
        dispatched ? 'done' : (approved ? 'current' : 'pending'),
        dispatched ? dispatched.timestamp : null,
        dispatched ? dispatched.message : ''));

    rows.push(row('received', 'Received',
        received ? 'done' : (dispatched ? 'current' : 'pending'),
        received ? received.timestamp : null,
        received ? received.message : ''));

    return rows;
}
