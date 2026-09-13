import { getSession } from '../Shared/Session';

/** Stepper initial value: preserved form value (defaulted on Continue). */
export default function QuantityDefault() {
    const q = getSession().flow.form.quantity;
    return q === null || q === undefined ? 1 : q;
}
