import { DEMO_MODE } from '../Shared/Config';

/** Visibility gate for demo-only UI. */
export default function IsDemoMode() {
    return DEMO_MODE === true;
}
