# Testing and Verification

This page documents exactly what is verified in Warehouse Lens, how, and - just as
important - what is not. Everything below the "Manual native checklist" heading is
unexecuted, and the "Unverified areas" section lists what has never been run.

## Verification pyramid

1. **Automated backend tests** - 41 Jest tests (37 against the real CAP service on
   in-memory SQLite at HTTP level with mocked auth, 4 pure unit tests). Run in CI
   on every push to `main` and every pull request.
2. **Static checks** - TypeScript typecheck and a full production build.
3. **MDK metadata checks** - `mdk validate` plus the authoritative
   `mdk build --target zip` bundle.
4. **Live HTTP smoke test** - a manual pass against `cds watch` on the dev machine,
   exercising the demo flow end to end at the OData layer.
5. **Manual native checklist** - on-device behavior. Defined below, **not executed**
   (no device/emulator run happened for this project).

## Automated backend tests (41 passing)

Run from `cap/`:

```bash
npm test
```

The suite lives in `cap/test/` (`units.test.ts`, `submit-transfer-request.test.ts`,
`read-access.test.ts`) and consists of 37 tests that boot the real CAP service via `cds.test()` - every
case goes through the real OData protocol layer, authorization checks included -
plus 4 pure unit tests in `units.test.ts` for the fingerprint and
reference-format helpers. All 41 tests pass locally (Windows, Node 24) and in the
GitHub Actions CI run on Ubuntu / Node 22 (both jobs green on the first run
after the initial push).

**Submission validation** (`submit-transfer-request.test.ts`)

- Valid request creates an `AWAITING_APPROVAL` request with a `TR-######` reference and one `SUBMITTED` event
- Zero quantity rejected (`INVALID_QUANTITY`)
- Negative quantity rejected (`INVALID_QUANTITY`)
- Fractional quantity rejected at the protocol layer (`Edm.Int32`)
- Quantity beyond availability rejected with the current number in the message (`INSUFFICIENT_AVAILABILITY`, 409, "Only 240")
- Absurdly large quantity rejected by the 100000 sanity cap
- Unknown material rejected (`MATERIAL_NOT_FOUND`, 404)
- Inactive material rejected (`MATERIAL_INACTIVE`)
- Unknown source warehouse rejected (`WAREHOUSE_NOT_FOUND`, 404)
- Inactive source warehouse rejected (`WAREHOUSE_INACTIVE`)
- Source equal to destination rejected (`SOURCE_EQUALS_DESTINATION`)
- Note over 200 characters rejected (protocol-level `String(200)` assert)
- Malformed idempotency key rejected (`INVALID_IDEMPOTENCY_KEY`)
- Availability drop between review and submit caught server-side (409, "Only 5")

**Idempotency and concurrency**

- Identical replay with the same key returns the existing request (`replayed: true`), creates no new row or event
- Same key with a different payload rejected as `IDEMPOTENCY_CONFLICT` (409)
- The same key used by two different users creates two independent requests
- Concurrent duplicate submissions produce exactly one persisted request (DB unique constraint arbitrates; the loser replays the winner)
- Unit tests: `payloadFingerprint` is stable, UUID-case-insensitive, treats null and empty note the same, and changes when any field changes (3 tests); `formatReference` zero-pads to six digits (1 test)

**Atomicity and rollback**

- A forced INSERT failure (unique reference collision) after validation rolls back everything: no request row, no event, and the reference counter is unchanged; the same payload then succeeds with the previously blocked reference

**Authorization and row-level access** (`read-access.test.ts`)

- A user without the `WarehouseUser` role cannot submit (403) and gets no read access at all (403)
- Users see only their own transfer requests; another user's request is a 404 by key
- Another user's request events are unreachable directly and via navigation
- The `WarehouseAdmin` role reads all users' requests
- `idempotencyKey` and `payloadFingerprint` are never exposed through the service
- Stock, request status, and events reject writes through the service (405)

**Availability derivation**

- MAT-1042 availability matches the demo inventory exactly (ALX 240, GIZ 65, SUZ 18, CAI 0, all EA)
- `availableQuantity` equals `onHandQuantity - reservedQuantity` on every row
- The find-stock query excludes the destination, filters inactive warehouses and zero availability, and sorts descending

**Dashboard**

- Counts are derived from data (pending count, Cairo low-stock count of 4 with the inactive material excluded)
- A user without an employee profile gets a graceful fallback

**Recent scans**

- `recordScan` validates the material (404 on unknown) and deduplicates per user
- Scan history is user-scoped and bounded to 10 entries

**List filters and pagination**

- Status filter, reference search (`contains`), `$top`/`$skip`/`$count` pagination
- Request detail exposes events ordered by timestamp for the timeline (SUBMITTED -> APPROVED -> DISPATCHED -> RECEIVED)

## Static checks

```bash
cd cap
npm run typecheck   # tsc --noEmit, clean
npm run build       # cds build --production + tsc precompile -> runnable JS in gen/srv
```

The build follows the documented CAP pattern of precompiling TypeScript for
production and removing leftover `.ts` files from `gen/`.

## MDK metadata checks

```bash
npm run mdk:validate   # from the repo root
npm run mdk:bundle     # mdk build --target zip -> mdk/.build/uploadBundle.zip
```

### The 9 known validator false positives

`mdk validate` reports up to 9 errors (the validator emits a nondeterministic
subset of them per run; a complete run shows all 9):

- `GetDashboard.action`: "missing" `materialID`, `sourceWarehouseID`,
  `destinationWarehouseID`, `quantity`, `idempotencyKey` (5 errors)
- `RecordScan.action`: "missing" `sourceWarehouseID`, `destinationWarehouseID`,
  `quantity`, `idempotencyKey` (4 errors)

`note` is never flagged (it is nullable), and `materialID` is never flagged on
`RecordScan.action` (recordScan genuinely declares and supplies it).

These are false positives. The validator checks each `CallFunction` action against
the **union of non-nullable parameters of all OData actions in the EDMX**, instead
of the parameters of the specific action being called. `getDashboard` takes no
parameters and `recordScan` takes only `materialID`; the flagged names all belong
to `submitTransferRequest`. The generated EDMX itself declares per-action
parameters correctly (standard CSDL), and the bundler accepts it.

CI encodes this precisely: the workflow greps the validator output and fails on
**any** error that does not match this exact documented pattern, so a real
metadata regression still breaks the build.

`mdk build --target zip` is the authoritative check: it runs the webpack rule
bundle, NativeScript style compilation, i18n processing, and binding
cross-reference checks, and it succeeds, producing `mdk/.build/uploadBundle.zip`.

## Live HTTP smoke test

Executed manually against `cds watch` (port 4004) on the dev machine, with the
seeded demo data. Verified in sequence:

- `getDashboard` returns Alex / Cairo with correct pending and low-stock counts
- MAT-1042 lookup returns the material details
- Find-stock query orders ALX 240 / GIZ 65 / SUZ 18
- Submitting 20 EA from Alexandria returns a real persisted reference (TR-001006, `AWAITING_APPROVAL`)
- Replaying the identical payload with the same key returns the same reference with `replayed: true`
- Pending count increments from 1 to 2

## Continuous integration

`.github/workflows/ci.yml` runs two jobs on `ubuntu-latest` with Node 22 on every
push to `main` and every pull request. No SAP credentials are required.

| Job | Steps |
| --- | --- |
| `backend` | `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` (41 tests), `npm run build` |
| `mdk` | `npm ci`, filtered `mdk validate` (fails on any non-documented error), `mdk build --target zip`, upload `uploadBundle.zip` as an artifact |

Native Android/iOS client builds are **not** covered by CI.

## Manual native checklist - UNEXECUTED

The following on-device checks are defined but have **not been executed**: no
Android/iOS device or emulator run happened for this project, and no app
screenshots exist. The list is the acceptance checklist for whoever runs the
client first.

- [ ] Valid scan via camera resolves the material
- [ ] Camera permission denied path shows the fallback
- [ ] Manual entry (AlternateInput) resolves a material
- [ ] Unknown material shows the not-found state
- [ ] Back navigation Review -> FindStock preserves quantity, note, and selection
- [ ] Quantity validation behaves correctly on device (stepper min/max)
- [ ] Network failure mid-flow shows clear messages
- [ ] Offline messaging (availability checks and submission need a connection)
- [ ] Double-tap on Submit creates only one request
- [ ] Kill the app during submit, retry: idempotent replay via the persisted draft key
- [ ] Submitted request visible after app restart
- [ ] Large text mode renders acceptably
- [ ] Keyboard interaction (note field, manual entry)
- [ ] Small-screen layout
- [ ] FindStock toolbar title updates on selection ("Select Alexandria")
- [ ] Haptics: N/A - not implemented ("where supported" was optional)

## Unverified areas

Being explicit about what has never been run:

- **Device runtime**: no native Android/iOS run; camera scanning, stepper
  appearance, and all checklist items above are untested on hardware.
- **Mobile Services**: the app and its `WarehouseLens` destination were created on
  a BTP trial, but the MDK metadata has not been deployed and no client has been
  onboarded.
- **HANA**: the MTA was deployed to a BTP trial and the HDI deployer task
  succeeded (schema + master data in HANA Cloud), but no authenticated read
  against it has been observed; business-rule testing ran on SQLite.
- **XSUAA**: deployed and enforcing (`401` for unauthenticated calls, role
  collection assigned to a user), but the end-to-end user login through the MDK
  client has not been run; automated auth testing used CAP mocked auth.
- **Toolbar dynamic title**: if the FioriToolbar does not re-evaluate its title
  rule on page redraw, the documented fallback is a static label.
- **OnLoaded vs OnLaunch race**: page `OnLoaded` may fire before the OData service
  initialization from `OnLaunch` completes. Mitigation: the Home load rule
  tolerates the failure with an offline hint, and a retry happens on the next
  `OnReturning`. Untested on device.

The backend was deployed to an SAP BTP trial (September 2026); trial resources
stop automatically, so it is a verified deployment rather than a permanently
running instance. Submitting a transfer request does not reserve stock or post
any goods movement to SAP S/4HANA - that is a future extension point only.
