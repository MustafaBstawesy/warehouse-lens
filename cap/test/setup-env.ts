// Let the CAP runtime resolve TypeScript service implementations
// (srv/warehouse-service.ts) under jest, the same way cds-tsx does in dev.
process.env.CDS_TYPESCRIPT = 'y';
