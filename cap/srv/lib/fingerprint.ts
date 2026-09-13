import { createHash } from 'node:crypto';

export interface SubmitPayload {
  materialID: string;
  sourceWarehouseID: string;
  destinationWarehouseID: string;
  quantity: number;
  note: string | null;
}

/**
 * Canonical SHA-256 fingerprint of a submission payload. Used to detect an
 * idempotency key being replayed with a DIFFERENT payload (rejected) versus
 * an identical retry of the same attempt (returns the existing request).
 */
export function payloadFingerprint(p: SubmitPayload): string {
  const canonical = JSON.stringify({
    materialID: (p.materialID || '').toLowerCase(),
    sourceWarehouseID: (p.sourceWarehouseID || '').toLowerCase(),
    destinationWarehouseID: (p.destinationWarehouseID || '').toLowerCase(),
    quantity: p.quantity,
    note: p.note ?? '',
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
