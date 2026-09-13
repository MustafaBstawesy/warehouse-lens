/**
 * Resets the LOCAL demo database: deletes exactly cap/db.sqlite (never a
 * directory, never anything recursive), redeploys the schema + CSV master
 * data, and reseeds the demo transfer requests.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertLocalDemoEnvironment } from './guard';

assertLocalDemoEnvironment();

const dbFile = resolve(__dirname, '..', 'db.sqlite');
if (existsSync(dbFile)) {
  unlinkSync(dbFile);
  console.log(`Deleted local demo database ${dbFile}`);
} else {
  console.log('No local demo database found - creating a fresh one.');
}

const result = spawnSync('npm', ['run', 'seed'], {
  cwd: resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
