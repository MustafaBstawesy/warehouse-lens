# BTP Deployment Guide

How to deploy the Warehouse Lens backend to SAP BTP Cloud Foundry and connect the
MDK client through SAP Mobile Services.

> **Status:** the backend MTA was deployed to an SAP BTP trial in September 2026
> (Cloud Foundry, us10-001): XSUAA, the HDI container on SAP HANA Cloud and the
> destination service instance were created, the HDI deployer task succeeded, and
> unauthenticated calls to the service return `401`. The Mobile Services app and its
> `WarehouseLens` destination were configured. The MDK metadata has not yet been
> deployed to Mobile Services and no device has been onboarded. Trial resources stop
> automatically, so this is a verified deployment, not a permanently running one.
>
> **Login path for the MDK client:** configure the Mobile Services app to sign users
> in through the backend's own XSUAA instance (`warehouse-lens-uaa`). The forwarded
> user token is then issued for the CAP app, so the `WarehouseLens` destination's
> Forward Authentication works without cross-app grants. `cap/xs-security.json`
> allows the Mobile Services hosts (`*.cfapps.us10-001` / `*.cfapps.us10`) as
> redirect URIs for exactly this reason.

## Placeholders used in this guide

| Placeholder | Meaning | Where to find it |
| --- | --- | --- |
| `<subaccount>` | Your BTP subaccount | BTP cockpit, subaccount overview |
| `<org>` | Cloud Foundry organization | Subaccount overview, "Cloud Foundry" section |
| `<space>` | Cloud Foundry space (e.g. `dev`) | Subaccount > Cloud Foundry > Spaces |
| `<api-endpoint>` | CF API endpoint | Subaccount overview (e.g. `https://api.cf.us10-001.hana.ondemand.com`) |
| `<srv-url>` | Deployed CAP service URL | `cf apps` route of `warehouse-lens-srv`, or the `cf deploy` log |
| `<user-email>` | A BTP user to assign roles to | Your identity provider / trial user email |

## Required entitlements

Assign these to the subaccount before deploying (BTP cockpit > Entitlements):

| Service | Plan | Used for |
| --- | --- | --- |
| Cloud Foundry Runtime | `MEMORY` | Runs `warehouse-lens-srv` (256M) and the DB deployer |
| Authorization and Trust Management (XSUAA) | `application` | OAuth scopes and role templates |
| SAP HANA Cloud | `hana` | The database instance itself |
| SAP HANA Schemas & HDI Containers | `hdi-shared` | The `warehouse-lens-db` HDI container |
| Destination | `lite` | Destination service instance bound to the srv module |
| SAP Mobile Services | `standard` (trial: `free`) | Mobile app registration and the MDK client connection |

## Required tools

| Tool | Purpose | Install |
| --- | --- | --- |
| `cf` CLI (v8+) | Cloud Foundry login and deployment | cloudfoundry.io downloads |
| MultiApps CF plugin | `cf deploy` for MTA archives | `cf install-plugin multiapps` |
| `mbt` | Build the MTA archive | `npm i -g mbt` |
| GNU `make` | Required by `mbt` (it generates a Makefile and runs `make`) | Linux/macOS: usually preinstalled. Windows: `winget install ezwinports.make` (then open a new shell so it is on PATH) |
| MDK tooling | Validate/bundle the client (`@sap/mdk-tools`, pinned at repo root) | `npm install` at repo root |
| SAP Business Application Studio (optional) | Alternative MDK deploy/build environment | BTP service subscription |

## 1. Deploy the CAP backend (mta.yaml)

```bash
cf login -a <api-endpoint>        # select <org> and <space>
npm run mta:build                  # = mbt build -p cf; produces mta_archives/warehouse-lens_1.0.0.mtar
cf deploy mta_archives/warehouse-lens_1.0.0.mtar
```

Notes on the build:

- `mta.yaml` uses a `before-all` custom builder. `mbt` executes commands without a
  shell, so shell syntax (`cd`, `&&`) is wrapped as
  `bash -c "cd cap && (npm ci || npm install) && npm run build"`.
- `npm run build` in `cap/` runs `cds build --production` plus a TypeScript
  precompile (`tsc -p tsconfig.build.json`), emitting runnable JavaScript into
  `cap/gen/srv/srv` and stripping leftover `.ts` files. The `warehouse-lens-srv`
  module deploys `cap/gen/srv`; the `warehouse-lens-db-deployer` module deploys
  `cap/gen/db`.
- Deployment creates three service instances: `warehouse-lens-uaa` (xsuaa,
  `application` plan, configured from `cap/xs-security.json`), `warehouse-lens-db`
  (hana, `hdi-shared`), and `warehouse-lens-destination` (destination, `lite`).

After `cf deploy` finishes, note the route of `warehouse-lens-srv` - that is
`<srv-url>`. The OData service lives at `https://<srv-url>/odata/v4/warehouse`.

## 2. HANA profile

The production profile in `cap/package.json` switches the database to HANA:

```json
"[production]": {
  "auth": { "kind": "xsuaa" },
  "db": { "kind": "hana", "impl": "@cap-js/hana" }
}
```

- The driver is `@cap-js/hana` `^2.8` (the 2.x major is compatible with `@sap/cds` 9;
  `@cap-js/hana` 3.x requires cds 10).
- Tables, unique indexes, and the CSV master data in `cap/db/data` are deployed by
  the `warehouse-lens-db-deployer` (`hdb` module) into the `hdi-shared` container.
- **The SAP HANA Cloud instance must be running and mapped to your CF space**
  (HANA Cloud Central > instance > Manage Mappings). If it is stopped (trial
  instances stop overnight) or unmapped, the deployer fails to acquire a container.

## 3. Authentication and roles

`cap/xs-security.json` (xsappname `warehouse-lens-cap`) defines:

- Scopes `$XSAPPNAME.WarehouseUser` and `$XSAPPNAME.WarehouseAdmin`.
- Role templates `WarehouseUser` (requester) and `WarehouseAdmin` (supervisor,
  which also includes the user scope).
- Role collections **"WL Warehouse User"** and **"WL Warehouse Supervisor"**,
  created automatically when the xsuaa instance is provisioned.

The service itself is annotated `@requires: 'WarehouseUser'`, so every caller needs
at least the user scope. Assign users in the BTP cockpit: subaccount > Security >
Role Collections > "WL Warehouse User" (or "WL Warehouse Supervisor") > Edit >
add `<user-email>`. Without an assignment, logins succeed but OData calls return 403.

## 4. SAP Mobile Services setup

1. Open the Mobile Services cockpit (see trial tips below) for `<org>`/`<space>`.
2. Create a new app:
   - ID: `com.sap.mdk.warehouselens` (matches `BundleID` in `mdk/MDKProject.json`)
   - Name: `Warehouse Lens`
   - Type: **Mobile Development Kit Application**
   - XSUAA security is the default for MDK apps; keep it.
3. Under Mobile Connectivity, create a destination named **`WarehouseLens`**
   (must match `DestinationName` in `mdk/Services/WarehouseService.service`):
   - URL: `https://<srv-url>/odata/v4/warehouse` - **including the OData path**.
     The `.service` file contributes no path of its own (`ServiceUrl` and
     `PathSuffix` are both empty), so the destination URL must point directly at
     the service root, with no trailing slash.
   - SSO mechanism: **Forward Authentication** (forwards the user's XSUAA token to
     the CAP service).
4. Use the destination's **Ping**/test button. Expect a 200/302-style success;
   a 401 here usually means the SSO mechanism is wrong, a 404 means the path
   suffix is missing.

## 5. Deploy MDK metadata and onboard the client

Deploy the bundled metadata to the Mobile Services app definition. Either:

```bash
# from the repo root
npm install
npm run mdk:bundle    # mdk build --target zip --project mdk
```

then upload `mdk/.build/uploadBundle.zip` in the Mobile Services cockpit
(app > Mobile App Update > upload bundle), or deploy directly from SAP Business
Application Studio / VS Code with the MDK extension (deploy landscape "standard").

Onboard a device:

1. Install the **SAP Mobile Services Client** app from the public app store
   (Android or iOS).
2. In the Mobile Services cockpit, open the app's onboarding QR code
   (APIs / onboarding tab).
3. Scan the QR with the client app, log in with a BTP user that holds the
   "WL Warehouse User" role collection, and the client downloads the deployed
   metadata bundle.

### Custom client requirements

A custom-built MDK client (via the MDK SDK) is only needed for custom branding,
a custom URL scheme, or third-party NativeScript plugins. **Warehouse Lens does not
require one**: it uses only standard MDK controls plus the built-in barcode scanner,
so the store-published SAP Mobile Services Client is sufficient. `MDKProject.json`
still carries `UrlScheme: warehouselens` for a future branded client build.

## Trial account tips

Observed on the prior sibling deployment (trial, region us10-001); presented as
practical hints, not guarantees:

- The CF API endpoint on this trial landscape is
  `https://api.cf.us10-001.hana.ondemand.com` - the `-001` suffix matters, and the
  Mobile Services cockpit dialogs expect the exact endpoint string.
- On trial, the Mobile Services cockpit is reached via the service marketplace
  tile's Support link
  (`mobile-service-cockpit-web.cfapps.us10.hana.ondemand.com`), not a subscription
  tile.
- Trial HANA Cloud instances are stopped automatically (e.g. overnight); restart
  the instance in HANA Cloud Central before deploying or demoing.
- Keep the `warehouse-lens-srv` memory at the modest 256M from `mta.yaml`; trial
  quota is limited.

## Local development instead

No BTP account is needed to run everything locally: `cd cap && npm install &&
npm run seed && npm run watch` serves the same OData service on port 4004 with
mocked authentication. Note that a phone cannot reach `localhost` of your dev
machine; for on-device tests against a local backend use the machine's LAN IP
(and the mocked-auth basic credentials), or deploy to BTP as described above.
