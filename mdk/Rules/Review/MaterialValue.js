import { getSession } from '../Shared/Session';

export default function MaterialValue() {
    const m = getSession().flow.material;
    return m ? m.materialCode + ' - ' + m.name : '';
}
