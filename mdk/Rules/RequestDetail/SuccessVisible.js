import { getSession } from '../Shared/Session';

/** The success banner only shows right after a confirmed submission. */
export default function SuccessVisible() {
    return getSession().justSubmitted === true;
}
