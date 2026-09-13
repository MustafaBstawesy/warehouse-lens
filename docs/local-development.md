# Local Development

Everything in this guide runs on your machine with no SAP account: the CAP backend runs
against a local SQLite file with mocked users, and the MDK metadata is validated and
bundled with `@sap/mdk-tools`. An SAP BTP account is only needed for cloud deployment and
for onboarding the mobile client through SAP Mobile Services (see `docs/btp-deployment.md`).

## Prerequisites

- Node.js 22 LTS recommended (the documented baseline for `@sap/cds` 9 and what CI uses).
  The backend declares `engines: >=20`; note that `@sap/mdk-tools` needs Node >= 22.13.
- npm (bundled with Node.js)
- git

## Install

Three independent npm workspaces, installed separately:

```bash
# CAP backend
cd cap
npm install

# MDK tooling (installed at the repo ROOT on purpose -- see the warning below)
cd ..
npm install

# Asset generator (only needed if you want to regenerate QR labels/images)
cd assets/tools
npm install
```

Warning: never install `@sap/mdk-tools` inside `mdk/`. The validator and bundler scan
every file under the project folder, including `node_modules`, which explodes the file
count (EMFILE) and produces bogus results. The root `package.json` exists precisely to
keep the tooling outside `mdk/`.

## Database seed and demo data

All commands below run inside `cap/`.

```bash
npm run seed
```

`seed` runs `cds deploy --to sqlite:db.sqlite` and then `tsx scripts/seed-demo.ts`. It
creates the file `cap/db.sqlite` with:

- 11 materials (1 inactive: MAT-1980) and 4 warehouses (CAI, ALX, GIZ, SUZ) from the
  semicolon-separated CSVs in `cap/db/data` (fixed, readable UUIDs)
- stock rows with non-zero reserved quantities, so availability = onHand - reserved varies
- demo transfer requests with event histories, using generated relative timestamps
- the reference counter row is created on first use (references start at TR-001001)

The seed is idempotent: running it again produces the same demo state.

```bash
npm run demo:reset
```

Deletes exactly `cap/db.sqlite` and reseeds. It is guarded by `scripts/guard.ts`, which
refuses to run in production or cloud-looking environments (NODE_ENV, CDS_ENV/profile,
VCAP_* variables, or a non-sqlite database kind).

```bash
npm run demo:advance TR-001004
npm run demo:advance TR-001004 -- --reject "Damaged stock"
```

Dev-only, simulated status progression for demo recordings. Events it writes are labeled
[SIMULATED]; there is no ERP integration behind it.

## Running the backend

```bash
cd cap
npm run watch     # cds watch --port 4004
```

The service is served at `http://localhost:4004/odata/v4/warehouse`. In dev the runtime
uses CAP mocked authentication with basic auth; the password is ignored:

| User | Roles                        | Home warehouse |
| ---- | ---------------------------- | -------------- |
| alex | WarehouseUser                | Cairo (CAI)    |
| dana | WarehouseUser                | Alexandria     |
| sam  | WarehouseUser, WarehouseAdmin| Cairo (CAI)    |
| bob  | (none - gets 403)            | -              |

Example calls:

```bash
# Read materials
curl -u alex: "http://localhost:4004/odata/v4/warehouse/Materials?\$top=3"

# Dashboard counts (modeled as an OData ACTION, so it is a POST)
curl -u alex: -X POST -H "Content-Type: application/json" -d "{}" \
  http://localhost:4004/odata/v4/warehouse/getDashboard

# Submit a transfer request: 20 EA of MAT-1042 from Alexandria to Cairo
curl -u alex: -X POST -H "Content-Type: application/json" \
  -d "{\"materialID\":\"aaaaaaaa-0000-4000-8000-000000001042\",\"sourceWarehouseID\":\"bbbbbbbb-0000-4000-8000-000000000002\",\"destinationWarehouseID\":\"bbbbbbbb-0000-4000-8000-000000000001\",\"quantity\":20,\"note\":\"Line 3 kanban\",\"idempotencyKey\":\"demo-key-0001\"}" \
  http://localhost:4004/odata/v4/warehouse/submitTransferRequest
```

The submit response contains the real reference (e.g. TR-001006), status
AWAITING_APPROVAL, and `replayed: false`. Repeating the exact same call returns the same
request with `replayed: true`; reusing the key with a different payload returns 409
IDEMPOTENCY_CONFLICT.

## Tests, typecheck, build

```bash
cd cap
npm test           # 41 jest tests against an in-memory SQLite database
npm run typecheck  # tsc --noEmit
npm run build      # cds build --production + tsc precompile into gen/srv/srv
```

Tests do not touch `cap/db.sqlite`; they run on `:memory:`. The build precompiles the
TypeScript handlers to JS (the documented CAP pattern for production) and removes leftover
`.ts` files from `gen/`.

## MDK tooling

Run from the repo root:

```bash
npm run mdk:validate   # mdk validate --project mdk
npm run mdk:bundle     # mdk build --target zip --project mdk -> mdk/.build/uploadBundle.zip
```

Known false positives in `mdk:validate`: 9 errors remain and are all documented false
positives. The validator checks each CallFunction against the union of non-nullable
parameters of ALL OData actions in the EDMX, so `GetDashboard.action` and
`RecordScan.action` are flagged for `submitTransferRequest`'s parameters. The EDMX itself
is correct CSDL. CI fails only on any OTHER validation error.

Regenerating the EDMX cache: whenever the CDS model changes, regenerate
`mdk/Services/.WarehouseService.xml` (required for bundling):

```bash
cd cap
npx cds compile srv --service WarehouseService --to edmx-v4 > "../mdk/Services/.WarehouseService.xml"
```

## Running on Android (summary)

Two ways to get the client onto a device; both are detailed in `docs/btp-deployment.md`:

1. SAP Mobile Services Client from Google Play ("SAP Mobile Services Client") plus an MDK
   app registration in SAP Mobile Services (QR onboarding). Requires a BTP account.
2. A custom-branded client built with the MDK SDK (BundleID `com.sap.mdk.warehouselens`).

Local-backend-on-device caveat: a phone cannot reach your machine's `localhost`. To point
a device at the local backend, use your machine's LAN IP (`http://<machine-ip>:4004`) and
the mocked basic-auth users above; an Android emulator can use `http://10.0.2.2:4004`.
Note that the on-device flow has not been executed in this repo's verification runs -- see
`docs/testing.md` for what is verified versus the manual on-device checklist.

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| `cds watch` fails: port 4004 in use | Another watch/serve instance is running. Stop it, or start with a different port: `npx cds watch --port 4005`. |
| `mdk validate` / `mdk build` crashes with EMFILE or scans thousands of files | `@sap/mdk-tools` was installed inside `mdk/`, so it scans its own `node_modules`. Remove `mdk/node_modules` and install at the repo root instead. |
| `mdk` CLI errors about the Node version | `@sap/mdk-tools` requires Node >= 22.13. Upgrade Node (22 LTS recommended). |
| Jest tests cannot find the service handlers / run stale JS | Handlers are TypeScript; the CAP runtime only resolves `.ts` implementations when `CDS_TYPESCRIPT=y`, which `cap/test/setup-env.ts` sets. Run tests via `npm test`, not by invoking jest with a different setup. |
| `SQLITE_BUSY` / database file locked during seed or reset | `cds watch` (or another process) holds `cap/db.sqlite` open. Stop the watcher, run `npm run seed` or `npm run demo:reset`, then restart it. |
| 403 on every request | You are calling as `bob` (no roles) or without basic auth. Use `-u alex:` (or dana/sam). |

## Regenerating demo assets (optional)

```bash
cd assets/tools
npm run generate
```

Regenerates the QR demo labels (e.g. `assets/qr-labels/MAT-1042.png`, `print-sheet.html`)
and rasterizes the original SVG illustrations. Outputs are committed, so this is only
needed after changing the sources in `assets/src`.
