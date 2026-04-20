import { useEffect, useRef } from 'react';

export interface BackoffPollerOptions {
  baseIntervalMs?: number;
  maxIntervalMs?: number;
}

export interface BackoffPoller {
  /** Cancel any pending timer and prevent further polling. Idempotent. */
  stop: () => void;
}

/**
 * Starts a polling chain with exponential backoff on error.
 *
 * Fires `poll` immediately, then reschedules based on the result:
 *  - success: next delay = baseIntervalMs (resets failure streak)
 *  - failure: next delay = min(baseIntervalMs * 2^(N-1), maxIntervalMs)
 *    where N is the consecutive-failure count
 *
 * Pure of React — usable in the hook below and directly in tests.
 * The `poll` callback MUST throw/reject on failure for backoff to engage.
 */
export function startBackoffPoller(
  poll: () => Promise<unknown>,
  options: BackoffPollerOptions = {},
): BackoffPoller {
  const {
    baseIntervalMs = 30_000,
    maxIntervalMs = 5 * 60_000,
  } = options;

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let consecutiveFailures = 0;

  const schedule = (delayMs: number) => {
    if (cancelled) return;
    timerId = setTimeout(run, delayMs);
  };

  const run = async () => {
    if (cancelled) return;
    try {
      await poll();
      if (cancelled) return;
      consecutiveFailures = 0;
      schedule(baseIntervalMs);
    } catch {
      if (cancelled) return;
      consecutiveFailures += 1;
      schedule(computeBackoffDelay(consecutiveFailures, baseIntervalMs, maxIntervalMs));
    }
  };

  // Fire immediately on start, then chain.
  run();

  return {
    stop: () => {
      cancelled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
  };
}

/**
 * Polling hook with exponential backoff on error.
 *
 * Starts at `baseIntervalMs`, doubles on each consecutive failure up to
 * `maxIntervalMs`, resets to base on success. Cleans up mid-backoff on unmount
 * or when `enabled` flips to false.
 *
 * The `poll` callback MUST throw (or reject) on failure for backoff to engage.
 */
export function usePollingWithBackoff(
  poll: () => Promise<unknown>,
  options: BackoffPollerOptions & { enabled?: boolean } = {},
): void {
  const {
    enabled = true,
    baseIntervalMs = 30_000,
    maxIntervalMs = 5 * 60_000,
  } = options;

  // Keep the latest poll fn in a ref so we don't resubscribe every render.
  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  useEffect(() => {
    if (!enabled) return;
    const poller = startBackoffPoller(() => pollRef.current(), {
      baseIntervalMs,
      maxIntervalMs,
    });
    return () => poller.stop();
  }, [enabled, baseIntervalMs, maxIntervalMs]);
}

/**
 * Computes the next delay for a given failure streak. Exposed for testing.
 * - 0 failures (just succeeded / first run) → baseIntervalMs
 * - N failures → min(base * 2^(N-1), max)
 */
export function computeBackoffDelay(
  consecutiveFailures: number,
  baseIntervalMs = 30_000,
  maxIntervalMs = 5 * 60_000,
): number {
  if (consecutiveFailures <= 0) return baseIntervalMs;
  return Math.min(
    baseIntervalMs * 2 ** (consecutiveFailures - 1),
    maxIntervalMs,
  );
}
