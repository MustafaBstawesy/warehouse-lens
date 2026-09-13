/**
 * Seeds demo transfer requests (with generated relative timestamps) into the
 * LOCAL development database. Master data is loaded by `cds deploy` from
 * db/data/*.csv; this script only adds the demo request histories.
 *
 * Safety: refuses to run against anything that looks like a cloud or
 * production configuration.
 */
import cds from '@sap/cds';
import { seedDemoRequests } from '../srv/lib/seed-demo';
import { assertLocalDemoEnvironment } from './guard';

async function main() {
  assertLocalDemoEnvironment();

  const csn = await cds.load('*');
  cds.model = cds.compile.for.nodejs(csn);
  const db = await cds.connect.to('db');

  const inserted = await seedDemoRequests(db);
  if (inserted === 0) {
    console.log('Demo requests already present - nothing to do.');
  } else {
    console.log(`Seeded ${inserted} demo transfer requests with event histories.`);
  }
  await (db as any).disconnect?.();
  process.exit(0);
}

main().catch((e) => {
  console.error('Seeding failed:', e.message ?? e);
  process.exit(1);
});
