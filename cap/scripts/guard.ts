import cds from '@sap/cds';

/**
 * Hard guard for demo-only scripts: they may only touch the local SQLite
 * demo database, never a cloud/production configuration.
 */
export function assertLocalDemoEnvironment(): void {
  const problems: string[] = [];

  if (process.env.NODE_ENV === 'production') {
    problems.push('NODE_ENV=production');
  }
  if (process.env.CDS_ENV === 'production' || (cds.env as any)?.profiles?.includes?.('production')) {
    problems.push('CDS production profile active');
  }
  if (process.env.VCAP_SERVICES || process.env.VCAP_APPLICATION) {
    problems.push('Cloud Foundry environment detected (VCAP_* set)');
  }
  const dbConfig = (cds.env?.requires as any)?.db;
  if (dbConfig && dbConfig.kind !== 'sqlite') {
    problems.push(`database kind is '${dbConfig.kind}', expected 'sqlite'`);
  }

  if (problems.length > 0) {
    console.error('REFUSING to run demo script outside the local demo setup:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(2);
  }
}
