import cds from '@sap/cds';

const { SELECT, INSERT, UPDATE } = cds.ql;

/** Minimal transaction shape we rely on (cds.tx or a service instance). */
export interface Runner { run(query: unknown): Promise<any>; }

/**
 * Allocates the next transfer-request reference (e.g. TR-001001) inside the
 * caller's transaction. Concurrency-safe by design:
 *  - the conditional UPDATE serializes concurrent allocators on the counter
 *    row (row lock on HANA, transaction serialization on SQLite), and
 *  - a rolled-back caller rolls back its increment with it.
 * Never derives the number from MAX(reference)+1.
 *
 * The counter row is created here on first use, deliberately NOT via a
 * db/data CSV: initial-data artifacts are re-imported on HANA redeployments,
 * which would reset a live counter and collide with existing references.
 *
 * Numbering gaps are possible and acceptable (e.g. a concurrent duplicate
 * submission that ends as an idempotent replay commits its increment without
 * creating a request). References must be unique, not dense.
 */
export async function nextReference(tx: Runner, name = 'transferRequest'): Promise<string> {
  const { Counters } = cds.entities('wl');

  const updated = await tx.run(
    UPDATE.entity(Counters).set({ value: { '+=': 1 } }).where({ name })
  );
  if (updated === 0) {
    // First use on a fresh database creates the row. A concurrent creator
    // loses the primary-key race and retries the UPDATE path.
    try {
      await tx.run(INSERT.into(Counters).entries({ name, value: 1001 }));
      return formatReference(1001);
    } catch {
      await tx.run(UPDATE.entity(Counters).set({ value: { '+=': 1 } }).where({ name }));
    }
  }
  const row = await tx.run(SELECT.one.from(Counters).where({ name }));
  if (!row) throw new Error(`Counter '${name}' not found after increment`);
  return formatReference(row.value);
}

export function formatReference(n: number): string {
  return `TR-${String(n).padStart(6, '0')}`;
}
