import { payloadFingerprint } from '../srv/lib/fingerprint';
import { formatReference } from '../srv/lib/reference';

describe('payloadFingerprint', () => {
  const base = {
    materialID: 'AAAAAAAA-0000-4000-8000-000000001042',
    sourceWarehouseID: 'bbbbbbbb-0000-4000-8000-000000000002',
    destinationWarehouseID: 'bbbbbbbb-0000-4000-8000-000000000001',
    quantity: 20,
    note: 'Line 3 is down.' as string | null,
  };

  test('is stable for identical payloads and case-insensitive for UUIDs', () => {
    const a = payloadFingerprint(base);
    const b = payloadFingerprint({ ...base, materialID: base.materialID.toLowerCase() });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test('changes when any field changes', () => {
    const a = payloadFingerprint(base);
    expect(payloadFingerprint({ ...base, quantity: 21 })).not.toBe(a);
    expect(payloadFingerprint({ ...base, note: null })).not.toBe(a);
    expect(payloadFingerprint({ ...base, sourceWarehouseID: 'bbbbbbbb-0000-4000-8000-000000000003' })).not.toBe(a);
  });

  test('treats null and empty note the same (both mean "no note")', () => {
    expect(payloadFingerprint({ ...base, note: null })).toBe(payloadFingerprint({ ...base, note: '' }));
  });
});

describe('formatReference', () => {
  test('zero-pads to six digits', () => {
    expect(formatReference(1001)).toBe('TR-001001');
    expect(formatReference(42)).toBe('TR-000042');
    expect(formatReference(1234567)).toBe('TR-1234567');
  });
});
