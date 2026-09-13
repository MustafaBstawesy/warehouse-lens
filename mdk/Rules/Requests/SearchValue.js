import { getSession } from '../Shared/Session';

/** Current search text (so redraws never wipe what the user typed). */
export default function SearchValue() {
    return getSession().requestsSearch || '';
}
