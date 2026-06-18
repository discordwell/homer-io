import { describe, it, expect, beforeEach, vi } from 'vitest';

// Shared mutable state for the mocks below. vi.hoisted() makes it available to
// the hoisted vi.mock() factory (which runs before the normal imports).
const h = vi.hoisted(() => ({
  // The [{ sum, count }] row the recompute's aggregate SELECT resolves to.
  aggRow: [] as Array<{ sum: string | null; count: string }>,
  // Values passed to every db.update().set(...) call.
  updates: [] as Array<Record<string, unknown>>,
}));

// Stub the DB layer: select() resolves to the queued aggregate row; update()
// records the values written so we can assert the recomputed average.
vi.mock('../lib/db.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(h.aggRow),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          h.updates.push(values);
          return Promise.resolve();
        },
      }),
    }),
  },
}));

// Silence the structured logger during tests.
vi.mock('../lib/logger.js', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
}));

import { averageServiceTimeSeconds, recomputeAddressAvgServiceTime } from './delivery-learning.js';

describe('averageServiceTimeSeconds — learned average service time', () => {
  it('averages the recorded samples', () => {
    expect(averageServiceTimeSeconds(300, 2)).toBe(150);
    expect(averageServiceTimeSeconds(450, 3)).toBe(150);
  });

  it('rounds to two decimal places (matching numeric(10,2))', () => {
    // 1000 / 3 = 333.333…
    expect(averageServiceTimeSeconds(1000, 3)).toBe(333.33);
  });

  it('returns null when there are no recorded samples', () => {
    expect(averageServiceTimeSeconds(null, 0)).toBeNull();
    // Defensive: a non-positive or null sum yields null rather than NaN/Infinity.
    expect(averageServiceTimeSeconds(100, 0)).toBeNull();
    expect(averageServiceTimeSeconds(null, 5)).toBeNull();
  });

  it('is computed over recorded samples, NOT successful_deliveries (the divisor bug)', () => {
    // Regression guard for the bug this fix addresses. The old incremental
    // update divided the running average by successful_deliveries, but the
    // samples folded in were "deliveries that recorded a service time" — which
    // diverges from the success count in both directions:
    //
    //   • a FAILED delivery can record a service time (driver reached the door)
    //   • a SUCCESSFUL delivery can record none (no GPS breadcrumb at the stop)
    //
    // Example: a 100s sample, then a successful delivery with no GPS sample,
    // then a 200s sample. Two samples were recorded ([100, 200]) but
    // successful_deliveries has reached 3.
    const sumOfRecordedSamples = 100 + 200;
    const recordedSampleCount = 2;
    const successfulDeliveries = 3;

    // Correct: average over the two recorded samples.
    expect(averageServiceTimeSeconds(sumOfRecordedSamples, recordedSampleCount)).toBe(150);

    // What the old code effectively did (divide by successful_deliveries) was
    // a different, wrong number — proving the divisor matters.
    expect(sumOfRecordedSamples / successfulDeliveries).toBeCloseTo(100, 5);
    expect(averageServiceTimeSeconds(sumOfRecordedSamples, recordedSampleCount))
      .not.toBe(sumOfRecordedSamples / successfulDeliveries);
  });

  it('is independent of how the samples split across success/failure', () => {
    // Whether [120, 180] came from two successes, two failures, or one of each,
    // the learned average is the same — it depends only on the recorded
    // service times, exactly what recomputing from delivery_metrics gives.
    expect(averageServiceTimeSeconds(120 + 180, 2)).toBe(150);
  });
});

describe('recomputeAddressAvgServiceTime — writes the average back', () => {
  beforeEach(() => {
    h.aggRow.length = 0;
    h.updates.length = 0;
  });

  it('parses the bigint sum/count strings and writes the rounded average', async () => {
    // postgres-js returns sum()/count() over an integer column as strings.
    h.aggRow.push({ sum: '450', count: '3' });

    await recomputeAddressAvgServiceTime('t1', 'addr1');

    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].avgServiceTimeSeconds).toBe('150');
    expect(h.updates[0].updatedAt).toBeInstanceOf(Date);
  });

  it('clears the column to null when no service time has been recorded', async () => {
    // sum() over zero non-null rows is NULL, count() is '0'.
    h.aggRow.push({ sum: null, count: '0' });

    await recomputeAddressAvgServiceTime('t1', 'addr1');

    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].avgServiceTimeSeconds).toBeNull();
  });

  it('handles a missing aggregate row defensively', async () => {
    // Empty result set (no metrics rows at all) must not throw or write NaN.
    await recomputeAddressAvgServiceTime('t1', 'addr1');

    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].avgServiceTimeSeconds).toBeNull();
  });
});
