import { selectedSource } from '../Shared/Flow';

/** Stepper upper bound: last known availability at the selected source. */
export default function QuantityMax() {
    const src = selectedSource();
    const available = src ? src.availableQuantity : 0;
    return available > 0 ? available : 1;
}
