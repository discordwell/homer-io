import { describe, it, expect } from 'vitest';
import { collectImportedExternalIds } from '../utils/integration-sync.js';

describe('collectImportedExternalIds', () => {
  it('includes only rows that link to a real HOMER order', () => {
    const ids = collectImportedExternalIds([
      { externalOrderId: 'a', orderId: 'order-a' },
      { externalOrderId: 'b', orderId: 'order-b' },
    ]);
    expect(ids).toEqual(new Set(['a', 'b']));
  });

  it('excludes prior FAILED rows so they are retried, not skipped forever', () => {
    // This is the regression guard: a once-failed order (orderId null) must not
    // be treated as already-synced, or it would be skipped on every future sync.
    const ids = collectImportedExternalIds([
      { externalOrderId: 'ok', orderId: 'order-ok' },
      { externalOrderId: 'failed', orderId: null },
    ]);
    expect(ids.has('ok')).toBe(true);
    expect(ids.has('failed')).toBe(false);
  });

  it('returns an empty set for no rows', () => {
    expect(collectImportedExternalIds([]).size).toBe(0);
  });

  it('returns an empty set when every row is a failed attempt', () => {
    const ids = collectImportedExternalIds([
      { externalOrderId: 'x', orderId: null },
      { externalOrderId: 'y', orderId: null },
    ]);
    expect(ids.size).toBe(0);
  });
});
