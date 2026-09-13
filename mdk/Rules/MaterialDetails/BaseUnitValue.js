import { getSession } from '../Shared/Session';

export default function BaseUnitValue() {
    const m = getSession().flow.material;
    return m ? m.baseUnit : '';
}
