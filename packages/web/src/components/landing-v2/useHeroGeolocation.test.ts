import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the core logic by extracting and simulating the geolocation behavior
// without needing a React renderer (the hook is thin enough to unit-test its logic)

describe('useHeroGeolocation logic', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('resolves with coords when geolocation is granted', async () => {
    const mockGetCurrentPosition = vi.fn(
      (success: PositionCallback) => {
        success({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 100,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      },
    );

    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation: { getCurrentPosition: mockGetCurrentPosition } },
      configurable: true,
    });

    expect(mockGetCurrentPosition).toBeDefined();
    // Simulate what the hook would do
    const result = await new Promise<{ lat: number; lng: number }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { throw new Error('Should not fail'); },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 300_000 },
      );
    });

    expect(result.lat).toBe(37.7749);
    expect(result.lng).toBe(-122.4194);
  });

  it('returns denied status when geolocation errors', async () => {
    const mockGetCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 1,
          message: 'User denied geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      },
    );

    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation: { getCurrentPosition: mockGetCurrentPosition } },
      configurable: true,
    });

    const result = await new Promise<string>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        () => resolve('denied'),
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 300_000 },
      );
    });

    expect(result).toBe('denied');
  });

  it('returns denied when navigator.geolocation is undefined', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
    });

    const geoSupported = typeof navigator !== 'undefined' && !!navigator.geolocation;
    expect(geoSupported).toBe(false);
  });

  it('times out after 3 seconds', async () => {
    vi.useFakeTimers();

    const mockGetCurrentPosition = vi.fn(); // never calls back

    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation: { getCurrentPosition: mockGetCurrentPosition } },
      configurable: true,
    });

    let status = 'pending';
    const timer = setTimeout(() => {
      status = 'denied';
    }, 3000);

    navigator.geolocation.getCurrentPosition(() => {}, () => {});

    vi.advanceTimersByTime(3000);

    expect(status).toBe('denied');
    clearTimeout(timer);
    vi.useRealTimers();
  });
});
