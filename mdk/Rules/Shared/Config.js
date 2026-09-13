/**
 * Central configuration for the Warehouse Lens client.
 * DEMO_MODE gates demo-only affordances (greeting name fallback,
 * "Use demo material" shortcut, demo-data indicator). Set to false for a
 * non-demo build; everything else keeps working against live data.
 */
export const DEMO_MODE = true;

/** Path of the OData service definition used by every read and action. */
export const SERVICE = '/mdk/Services/WarehouseService.service';

/** Bounded list sizes (online-first MVP; see docs/architecture.md). */
export const RECENT_SCANS_LIMIT = 5;
export const REQUESTS_PAGE_SIZE = 50;

/** Client-side guard for scanned/manual material codes: plain data only. */
export const MATERIAL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,19}$/;

export default function Config() {
    return { DEMO_MODE, SERVICE };
}
