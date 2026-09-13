import { getSession } from '../Shared/Session';

/** Context-aware empty state: error vs. no-search-results vs. truly empty. */
export default function EmptyCaption(context) {
    const s = getSession();
    if (s.requestsError) {
        return context && context.localizeText
            ? context.localizeText('requests_emptyError')
            : 'Could not load requests. Pull back and retry.';
    }
    if (s.requestsSearch) {
        return context && context.localizeText
            ? context.localizeText('requests_emptysearch')
            : 'No requests match your search.';
    }
    if (s.requestsFilter && s.requestsFilter !== 'ALL') {
        return context && context.localizeText
            ? context.localizeText('requests_emptyFilter')
            : 'No requests with this status.';
    }
    return context && context.localizeText
        ? context.localizeText('requests_empty')
        : 'No transfer requests yet.';
}
