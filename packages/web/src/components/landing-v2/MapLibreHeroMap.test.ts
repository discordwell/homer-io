import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for MapLibreHeroMap ready-signal logic.
 *
 * We don't render the React component (that needs a full DOM + MapLibre GL
 * context). Instead we replicate the event wiring logic from the component
 * and verify:
 *   1. 'styledata' triggers onReady (fast path)
 *   2. 'load' triggers onReady when 'styledata' never fires
 *   3. The fallback timer (2500ms) triggers onReady when no events fire
 *   4. onReady is called at most once regardless of how many triggers fire
 */

/** Minimal mock that mirrors the subset of maplibregl.Map used by the component */
function createMockMap() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const onceListeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  return {
    on(event: string, fn: (...args: unknown[]) => void) {
      (listeners[event] ??= []).push(fn);
    },
    once(event: string, fn: (...args: unknown[]) => void) {
      (onceListeners[event] ??= []).push(fn);
    },
    off(event: string, fn: (...args: unknown[]) => void) {
      listeners[event] = (listeners[event] ?? []).filter((f) => f !== fn);
      onceListeners[event] = (onceListeners[event] ?? []).filter((f) => f !== fn);
    },
    /** Simulate emitting an event */
    emit(event: string, ...args: unknown[]) {
      for (const fn of listeners[event] ?? []) fn(...args);
      // once listeners fire once then are removed
      const onceFns = onceListeners[event] ?? [];
      onceListeners[event] = [];
      for (const fn of onceFns) fn(...args);
    },
    remove: vi.fn(),
  };
}

/**
 * Replicates the event-wiring logic from MapLibreHeroMap so we can
 * test it in isolation without rendering React or needing a real GL context.
 */
function wireReady(
  map: ReturnType<typeof createMockMap>,
  onReady: () => void,
) {
  let readyFired = false;

  const handleReady = () => {
    if (readyFired) return;
    readyFired = true;
    onReady();
  };

  map.once('styledata', handleReady);
  map.on('load', handleReady);
  const fallbackTimer = setTimeout(handleReady, 2500);

  return {
    cleanup() {
      clearTimeout(fallbackTimer);
      map.off('load', handleReady);
      map.off('styledata', handleReady);
    },
  };
}

describe('MapLibreHeroMap ready-signal logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onReady on styledata (fast path)', () => {
    const map = createMockMap();
    const onReady = vi.fn();
    const { cleanup } = wireReady(map, onReady);

    map.emit('styledata');

    expect(onReady).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('fires onReady on load when styledata never fires', () => {
    const map = createMockMap();
    const onReady = vi.fn();
    const { cleanup } = wireReady(map, onReady);

    map.emit('load');

    expect(onReady).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('fires onReady via fallback timer at 2500ms when no events fire', () => {
    const map = createMockMap();
    const onReady = vi.fn();
    const { cleanup } = wireReady(map, onReady);

    // Not yet at 2499ms
    vi.advanceTimersByTime(2499);
    expect(onReady).not.toHaveBeenCalled();

    // At 2500ms the fallback kicks in
    vi.advanceTimersByTime(1);
    expect(onReady).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('calls onReady at most once even when all three triggers fire', () => {
    const map = createMockMap();
    const onReady = vi.fn();
    const { cleanup } = wireReady(map, onReady);

    // All three triggers fire
    map.emit('styledata');
    map.emit('load');
    vi.advanceTimersByTime(3000);

    expect(onReady).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('does not fire onReady after cleanup', () => {
    const map = createMockMap();
    const onReady = vi.fn();
    const { cleanup } = wireReady(map, onReady);

    cleanup();

    map.emit('styledata');
    map.emit('load');
    vi.advanceTimersByTime(3000);

    expect(onReady).not.toHaveBeenCalled();
  });
});
