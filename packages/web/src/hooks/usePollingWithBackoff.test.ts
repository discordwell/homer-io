import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeBackoffDelay,
  startBackoffPoller,
  usePollingWithBackoff,
} from './usePollingWithBackoff.js';

describe('computeBackoffDelay', () => {
  it('returns base interval when no failures have occurred', () => {
    expect(computeBackoffDelay(0)).toBe(30_000);
  });

  it('returns base interval on first failure', () => {
    expect(computeBackoffDelay(1)).toBe(30_000);
  });

  it('doubles on each consecutive failure', () => {
    expect(computeBackoffDelay(2)).toBe(60_000);
    expect(computeBackoffDelay(3)).toBe(120_000);
    expect(computeBackoffDelay(4)).toBe(240_000);
  });

  it('caps at maxIntervalMs (5 min by default)', () => {
    expect(computeBackoffDelay(5)).toBe(300_000);
    expect(computeBackoffDelay(10)).toBe(300_000);
    expect(computeBackoffDelay(100)).toBe(300_000);
  });

  it('respects custom base and max', () => {
    expect(computeBackoffDelay(3, 1_000, 10_000)).toBe(4_000);
    expect(computeBackoffDelay(10, 1_000, 10_000)).toBe(10_000);
  });
});

describe('startBackoffPoller — fake-timer integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires poll immediately on start', async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    const poller = startBackoffPoller(poll);

    // Let the immediate promise settle.
    await vi.advanceTimersByTimeAsync(0);

    expect(poll).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('re-fires at base interval after a success', async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    const poller = startBackoffPoller(poll);

    await vi.advanceTimersByTimeAsync(0); // first fire
    expect(poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000); // base interval
    expect(poll).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(poll).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it('doubles delay after each consecutive failure up to cap', async () => {
    const poll = vi.fn().mockRejectedValue(new Error('fail'));
    const poller = startBackoffPoller(poll);

    // Run #1 (immediate, fails) → next delay 30s
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(1);

    // After 29s nothing yet.
    await vi.advanceTimersByTimeAsync(29_000);
    expect(poll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000); // 30s total → run #2
    expect(poll).toHaveBeenCalledTimes(2);

    // Run #2 failed → next delay 60s
    await vi.advanceTimersByTimeAsync(59_000);
    expect(poll).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(poll).toHaveBeenCalledTimes(3);

    // Run #3 failed → next delay 120s
    await vi.advanceTimersByTimeAsync(119_000);
    expect(poll).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(poll).toHaveBeenCalledTimes(4);

    // Run #4 failed → next delay 240s
    await vi.advanceTimersByTimeAsync(239_000);
    expect(poll).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(poll).toHaveBeenCalledTimes(5);

    // Run #5 failed → next delay min(480s, 300s cap) = 300s
    await vi.advanceTimersByTimeAsync(299_000);
    expect(poll).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(poll).toHaveBeenCalledTimes(6);

    // Still capped at 300s.
    await vi.advanceTimersByTimeAsync(299_000);
    expect(poll).toHaveBeenCalledTimes(6);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(poll).toHaveBeenCalledTimes(7);

    poller.stop();
  });

  it('resets to base interval after a success following failures', async () => {
    let shouldFail = true;
    const poll = vi.fn().mockImplementation(() => {
      if (shouldFail) return Promise.reject(new Error('nope'));
      return Promise.resolve();
    });
    const poller = startBackoffPoller(poll);

    await vi.advanceTimersByTimeAsync(0); // run #1, fails
    expect(poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000); // run #2, still fails
    expect(poll).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000); // run #3, still fails
    expect(poll).toHaveBeenCalledTimes(3);

    // Recover — next call succeeds (scheduled 120s from now).
    shouldFail = false;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(poll).toHaveBeenCalledTimes(4);

    // After success, delay resets to base (30s), NOT 240s.
    await vi.advanceTimersByTimeAsync(29_000);
    expect(poll).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(poll).toHaveBeenCalledTimes(5);

    poller.stop();
  });

  it('stop() cancels pending timer and prevents further firings', async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    const poller = startBackoffPoller(poll);

    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(1);

    poller.stop();

    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('stop() works mid-backoff (during a long failure wait)', async () => {
    const poll = vi.fn().mockRejectedValue(new Error('fail'));
    const poller = startBackoffPoller(poll);

    // 4 failures → next delay would be 240s
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(poll).toHaveBeenCalledTimes(4);

    // We're now waiting 240s. Stop mid-wait.
    await vi.advanceTimersByTimeAsync(100_000);
    expect(poll).toHaveBeenCalledTimes(4);

    poller.stop();

    // The pending 240s timer should never fire.
    await vi.advanceTimersByTimeAsync(200_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(poll).toHaveBeenCalledTimes(4);
  });

  it('stop() during in-flight poll prevents rescheduling', async () => {
    let resolvePending!: () => void;
    const poll = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolvePending = resolve; }),
    );
    const poller = startBackoffPoller(poll);

    // Start the first poll (it's pending).
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(1);

    // Stop before it resolves.
    poller.stop();

    // Resolve the in-flight poll; the post-await cancelled check should
    // prevent rescheduling.
    resolvePending();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(poll).toHaveBeenCalledTimes(1);
  });
});

describe('module exports', () => {
  it('exports both the hook and the pure helpers', () => {
    expect(typeof usePollingWithBackoff).toBe('function');
    expect(typeof startBackoffPoller).toBe('function');
    expect(typeof computeBackoffDelay).toBe('function');
  });
});
