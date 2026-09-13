/**
 * DEVELOPMENT-ONLY SIMULATION: advances a transfer request to its next
 * lifecycle status and appends the matching event, so later timeline stages
 * can be demonstrated. This is a local demo aid - it does NOT represent any
 * ERP integration, approval workflow, or goods movement.
 *
 * Usage: npx tsx scripts/advance-request.ts TR-001004 [--reject "reason"]
 */
import cds from '@sap/cds';
import { assertLocalDemoEnvironment } from './guard';

const NEXT: Record<string, { status: string; event: string; message: string }> = {
  AWAITING_APPROVAL: { status: 'APPROVED', event: 'APPROVED', message: '[SIMULATED] Approved by warehouse supervisor.' },
  APPROVED: { status: 'DISPATCHED', event: 'DISPATCHED', message: '[SIMULATED] Picked up by internal shuttle.' },
  DISPATCHED: { status: 'RECEIVED', event: 'RECEIVED', message: '[SIMULATED] Goods received at destination.' },
};

async function main() {
  assertLocalDemoEnvironment();

  const reference = process.argv[2];
  const rejectIdx = process.argv.indexOf('--reject');
  if (!reference || !/^TR-\d{6}$/.test(reference)) {
    console.error('Usage: npx tsx scripts/advance-request.ts TR-000000 [--reject "reason"]');
    process.exit(1);
  }

  const csn = await cds.load('*');
  cds.model = cds.compile.for.nodejs(csn);
  const db = await cds.connect.to('db');
  const { SELECT, INSERT, UPDATE } = cds.ql;
  const { TransferRequests } = cds.entities('wl');
  const { RequestEvents } = cds.entities('wl');

  const request = await db.run(SELECT.one.from(TransferRequests).where({ reference }));
  if (!request) {
    console.error(`No transfer request with reference ${reference}.`);
    process.exit(1);
  }

  let next: { status: string; event: string; message: string };
  if (rejectIdx > -1) {
    if (request.status !== 'AWAITING_APPROVAL') {
      console.error(`Only AWAITING_APPROVAL requests can be rejected (current: ${request.status}).`);
      process.exit(1);
    }
    const reason = process.argv[rejectIdx + 1] || 'Rejected in local demo.';
    next = { status: 'REJECTED', event: 'REJECTED', message: `[SIMULATED] ${reason}` };
  } else {
    const step = NEXT[request.status];
    if (!step) {
      console.error(`Request ${reference} is ${request.status} - no further simulated step.`);
      process.exit(1);
    }
    next = step;
  }

  const now = new Date().toISOString();
  await db.run(UPDATE.entity(TransferRequests).set({ status: next.status, modifiedAt: now }).where({ ID: request.ID }));
  await db.run(
    INSERT.into(RequestEvents).entries({
      request_ID: request.ID,
      eventType: next.event,
      timestamp: now,
      actor: 'supervisor.demo',
      message: next.message,
    })
  );
  console.log(`${reference}: ${request.status} -> ${next.status} (simulated, local demo only)`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Failed:', e.message ?? e);
  process.exit(1);
});
