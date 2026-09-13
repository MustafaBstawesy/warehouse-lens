import { getSession } from '../Shared/Session';

/** Success banner row with the real, backend-generated reference. */
export default function SuccessItems() {
    const r = getSession().currentRequest;
    return [{
        image: '/mdk/Images/success.png',
        title: 'Request submitted',
        subhead: r ? r.reference : '',
        footnote: 'Approval is required before stock moves.'
    }];
}
