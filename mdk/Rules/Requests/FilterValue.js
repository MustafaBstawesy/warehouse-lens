import { getSession } from '../Shared/Session';

/** Current status filter for the ListPicker. */
export default function FilterValue() {
    return getSession().requestsFilter || 'ALL';
}
