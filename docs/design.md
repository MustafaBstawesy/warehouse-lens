# Design Notes

How the Warehouse Lens MDK client implements the product brief's design system, and where it deliberately deviates.

## No mockup file was provided

No screen mockup file was attached or present in the workspace when this app was built. The UI therefore implements the *written* design system of the product brief (color tokens, spacing scale, typography hierarchy, one-primary-action-per-screen) using standard SAP MDK controls. Where a literal reading of the brief would have required custom native extension controls, the app stays on supported MDK controls instead; every such deviation is listed at the end of this document.

## Color tokens

All colors live in `mdk/Styles/Styles.less` as flat NSS class blocks (font-size + color only; see the spacing section for why). Classes are prefixed `wl-`.

| Token | Hex | Styles.less classes | Used for |
| --- | --- | --- | --- |
| Navy | `#102335` | `wl-value-strong`, `wl-qty`, `wl-success-ref`, `wl-status-dispatched` | Emphasized values: quantities, the TR reference, dispatched status |
| Teal | `#087F82` | `wl-demo-badge`, `wl-kpi-value`, `wl-hero-subhead`, `wl-selected-note`, `wl-qty-selected`, `wl-status-approved`, `wl-step-current` | Brand accent: KPI numbers, material code subhead, selection feedback, approved status, current timeline step |
| Mint | `#E7F7F3` | (none) | Reserved surface tint from the brief; not expressible as an NSS text class, surfaces come from the native Fiori theme |
| Background | `#F5F7FA` | (none) | Page background intent; actual background is the native Fiori theme's |
| Text | `#162536` | `wl-greeting-title`, `wl-card-title`, `wl-hero-title`, `wl-info-value`, `wl-scan-value` | Primary text |
| Secondary | `#607185` | `wl-greeting-subhead`, `wl-card-subhead`, `wl-muted`, `wl-desc`, `wl-hint-value`, `wl-hint-caption`, `wl-step-pending` | Secondary text, hints, pending timeline steps |
| Borders | `#DFE6ED` | (none) | Divider intent; separators are drawn by the native cells |
| Amber | `#B45309` | `wl-kpi-warn`, `wl-badge-low`, `wl-status-pending` | Low stock, awaiting approval |
| Red | `#C0392B` | `wl-badge-out`, `wl-status-rejected`, `wl-step-rejected` | Out of stock, rejected, errors |
| Green | `#2E7D32` | `wl-success-title`, `wl-badge-ok`, `wl-status-received`, `wl-step-done` | In stock, received, completed steps, submit success |

Per-row status coloring is done with a bindable style: list rows set `"Styles": { "StatusText": "{statusStyle}" }` and a rule returns the matching `wl-status-*` / `wl-badge-*` class name per record.

## Spacing

The brief's spacing scale is 4 / 8 / 12 / 16 / 24 / 32. In this app that scale is an *intent*, not a set of applied values: MDK NSS styling here is deliberately limited to `font-size` and `color` classes (a proven constraint of the flat-class approach used in `Styles.less` - no LESS variables or nesting). Layout, paddings, rounded cards, and shadows all come from the native Fiori theme that the MDK client applies to SectionedTable, ObjectCell, FormCell, and FioriToolbar controls. The native theme's rhythm is consistent with the 4/8-based scale, so the screens read as intended without hand-set paddings.

## Typography hierarchy

The Home page title uses the ActionBar caption with `"PreferredCaptionSize": "Large"`; the other six pages use the standard ActionBar caption size. Everything below that is a class in `Styles.less` (unitless `font-size`):

| Size | Classes | Role |
| --- | --- | --- |
| 22 | `wl-greeting-title` | Home greeting ("Good morning, Alex") |
| 20 | `wl-kpi-value`, `wl-kpi-warn`, `wl-hero-title`, `wl-scan-value`, `wl-success-title` | KPI numbers, material name, scan entry, success headline |
| 17 | `wl-value-strong`, `wl-qty`, `wl-qty-selected` | Emphasized quantities |
| 16 | `wl-card-title`, `wl-success-ref` | Cell titles, TR reference |
| 15 | `wl-info-value` | Detail field values |
| 14 | `wl-greeting-subhead`, `wl-hero-subhead` | Subheads under titles |
| 13 | `wl-card-subhead`, `wl-desc`, `wl-hint-value`, `wl-hint-caption`, all `wl-badge-*`, `wl-status-*`, `wl-step-*` | Body/supporting text, badges, statuses, timeline |
| 12 | `wl-muted`, `wl-selected-note` | Fine print, selection note |
| 11 | `wl-demo-badge` | Demo-mode badge |

## Images and text assets

- `mdk/Images/` ships three original illustrations: `mat-1042.png` (the demo material), `mat-generic.png` (fallback for all other materials), and `success.png` (confirmation). No SAP logos or third-party artwork are used.
- Printable QR labels for scanning live in `assets/qr-labels/` with a generator under `assets/tools/`.
- `mdk/i18n/i18n.properties` holds all metadata-referenced strings (captions, placeholders, hints, messages looked up via `$(L,...)` and `context.localizeText`) and is kept pure ASCII (a proven constraint: the loader breaks on non-ASCII characters). Known limitation: some rule-generated dynamic texts (greeting words, timeline step labels, status labels, the dynamic "Select <city>" button title, and the launch-failure dialog) are currently hardcoded in English inside `mdk/Rules/` - the demo is English-only, and full localization of rule output is listed as a future improvement.

## Reusable component patterns

MDK has no component system in the web-framework sense; "components" here are shared metadata patterns plus rule helpers reused across pages.

| Brief component | Implementation |
| --- | --- |
| Primary action button | `Control.Type.FioriToolbar` with a single `FioriToolbarItem.Type.Button` per page (one primary action per screen) |
| Material summary | `ObjectCell` with `DetailImage` (thumbnail from `mdk/Images/`), title + code subhead |
| Stock badge | `availabilityBadge(available, reorderPoint, unit)` rule in `mdk/Rules/Shared/Format.js` returning text styled with `wl-badge-ok` / `wl-badge-low` / `wl-badge-out` |
| Warehouse selection card | `ObjectCell` with bindable `"AccessoryType": "{accessory}"` (checkmark when selected) plus `wl-qty-selected` / `wl-selected-note` styling |
| Quantity input | `Control.Type.FormCell.Stepper` (`QuantityStepper` in `mdk/Pages/Review.page`), Min 1, Max = last known availability, editable numeric field |
| Request summary + timeline | Rule-built `ObjectTable` rows (`RequestDetail.page`), timeline steps styled `wl-step-done` / `wl-step-current` / `wl-step-pending` / `wl-step-rejected` |
| Empty / error states | `EmptySection` captions on Home, FindStock, Requests, and RequestDetail; the Requests list additionally uses a context-aware caption rule (error vs no-search-results vs empty-filter vs genuinely empty), while the other three use static captions |

## Navigation map

Seven pages, one linear happy path plus a tracking branch:

```text
Home -> Scan -> MaterialDetails -> FindStock -> Review -> RequestDetail (confirmation)
Home -> Requests -> RequestDetail (same page component)
```

| Page | Purpose | Primary toolbar action |
| --- | --- | --- |
| `Home.page` | Greeting, KPIs (pending requests, low stock), recent scans | "Scan material" |
| `Scan.page` | Native scanner launch + manual entry fallback | "Open camera scanner" |
| `MaterialDetails.page` | Material hero cell, local stock, description | "Find stock" |
| `FindStock.page` | Availability at other warehouses, source selection | "Select `<city>`" (rule-driven) |
| `Review.page` | Quantity stepper, note, approval hint | "Submit request" |
| `RequestDetail.page` | Confirmation (post-submit) or stored request + timeline | "View requests" |
| `Requests.page` | Own requests with search + status filter | (none - list page) |

Back-stack behavior and state rules:

- `RequestDetail` doubles as the post-submit confirmation via a `justSubmitted` flag; the same page renders a stored request when opened from `Requests`.
- After a successful submit, navigation runs `mdk/Actions/Navigation/NavToRequestDetailAfterSubmit.action` with `"ClearHistory": true`, so Back from the confirmation returns to Home - never to a stale Review screen that could resubmit.
- In-flow state (scanned material, selected source warehouse, quantity, note) lives in a module-singleton `Session.js`, so navigating back from Review to FindStock re-renders from session state and preserves the user's inputs. On-device back-navigation behavior is on the manual test checklist (not yet executed on hardware).
- `ODataService.Initialize` runs in `OnLaunch`; Home's loaded handler tolerates an initialization race with an offline hint and retries on the next `OnReturning`.

## Accessibility

- Touch targets: all interactive elements are standard MDK cells and toolbar buttons, which meet the 44 pt (iOS) / 48 dp (Android) minimum by default.
- Status is never color-only: every colored badge or status is a text label ("Low stock", "Awaiting approval"), with color as reinforcement.
- Every form field has a caption (including the Note field), which the native controls expose as the accessible name.
- Large-text settings are honored by the native cells; the NSS font sizes scale with them.
- Focus order follows document order - pages are single-column sectioned tables with no custom z-ordering.
- Safe areas (notches, home indicators) are handled by the MDK client shell.
- No decorative charts; all numbers appear as plain text.

## Interaction details

- Submit shows a modal activity indicator until the backend confirms; there are no artificial delays anywhere in the app.
- Scanning is serialized: a `scanInFlight` flag plus a promise-chained handler prevents duplicate scanner callbacks from firing the lookup twice, and the manual-entry field is cleared programmatically before async work starts.
- Failure states are designed, not generic: on `INSUFFICIENT_AVAILABILITY` the Review page refreshes availability and asks the user to revise the quantity; on a timeout the persisted idempotency key is kept so a retry replays the same request instead of duplicating it.
- The Note field shows a live `0/200` character counter, and an approval hint under the form states that submitting requests approval rather than moving stock.
- The app is online-only by design (`OfflineEnabled: false`); offline states show clear messages that availability checks and submission need a connection, instead of silently failing.
- Haptic feedback is NOT implemented. The brief listed it as "where supported" optional; it would require platform-specific extension code and is noted as a possible enhancement, not a shipped capability.

## Deviations from the mockup intent

Since no mockup file existed, these are deviations from a literal reading of the brief's visual descriptions, chosen to stay within supported MDK controls:

1. **Full-screen native scanner instead of an inline camera frame.** Scanning uses `Action.Type.CheckBarcodeScannerPrerequisite` + `Action.Type.OpenBarcodeScanner`, the supported native pattern; the camera is owned and released by the MDK client. An embedded viewfinder inside the page would need a custom extension control.
2. **Thumbnail instead of hero image.** The material image renders as an `ObjectCell` `DetailImage` (thumbnail size) rather than oversized hero imagery. A custom extension control could render a hero image but was deliberately avoided in favor of supported controls.
3. **Native theme owns surfaces.** Rounded cards, shadows, backgrounds, and paddings come from the Fiori native theme rather than free-form tokens; NSS classes only set text size and color (mint, background, and border tokens are therefore intent-only, per the color table).
4. **Dynamic toolbar title pending device verification.** The FindStock primary button title is rule-driven (`mdk/Rules/FindStock/ContinueTitle.js` returns "Select Alexandria" style labels). Whether the FioriToolbar re-evaluates this rule on page redraw is not yet verified on a device; the documented fallback is a static "Continue" label.
