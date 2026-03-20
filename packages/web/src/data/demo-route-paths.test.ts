import { describe, it, expect } from 'vitest';
import { advanceAlongPath, DEMO_ROUTE_PATHS } from './demo-route-paths.js';

describe('advanceAlongPath', () => {
  const simplePath: [number, number][] = [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ];

  it('advances along a straight path', () => {
    const result = advanceAlongPath(0, 0, simplePath, 0.5);
    expect(result.pathIndex).toBe(0);
    expect(result.fraction).toBeCloseTo(0.5);
    expect(result.lat).toBeCloseTo(0);
    expect(result.lng).toBeCloseTo(0.5);
  });

  it('crosses segment boundaries', () => {
    const result = advanceAlongPath(0, 0, simplePath, 1.5);
    expect(result.pathIndex).toBe(1);
    expect(result.fraction).toBeCloseTo(0.5);
    expect(result.lng).toBeCloseTo(1.5);
  });

  it('loops back to start when reaching the end', () => {
    const result = advanceAlongPath(2, 0.5, simplePath, 2.0);
    expect(result.looped).toBe(true);
    expect(result.pathIndex).toBeLessThan(simplePath.length - 1);
  });

  it('returns correct heading (east = 90)', () => {
    const result = advanceAlongPath(0, 0, simplePath, 0.1);
    expect(result.heading).toBeCloseTo(90, 0);
  });

  it('returns heading 0 for north-facing path', () => {
    const northPath: [number, number][] = [[0, 0], [1, 0], [2, 0]];
    const result = advanceAlongPath(0, 0, northPath, 0.1);
    expect(result.heading).toBeCloseTo(0, 0);
  });

  it('handles zero distance (no movement)', () => {
    const result = advanceAlongPath(1, 0.3, simplePath, 0);
    expect(result.pathIndex).toBe(1);
    expect(result.fraction).toBeCloseTo(0.3);
  });
});

describe('DEMO_ROUTE_PATHS', () => {
  it('has 2 routes', () => {
    expect(DEMO_ROUTE_PATHS).toHaveLength(2);
  });

  it('Morning SF Route has 6 stops and ~46 waypoints', () => {
    const morning = DEMO_ROUTE_PATHS[0];
    expect(morning.routeName).toBe('Morning SF Route');
    expect(morning.stops).toHaveLength(6);
    expect(morning.path.length).toBeGreaterThanOrEqual(40);
    expect(morning.status).toBe('completed');
  });

  it('Midday East Bay Route has 5 stops and is in_progress', () => {
    const midday = DEMO_ROUTE_PATHS[1];
    expect(midday.routeName).toBe('Midday East Bay Route');
    expect(midday.stops).toHaveLength(5);
    expect(midday.status).toBe('in_progress');
  });

  it('stop pathIndex values are within path bounds', () => {
    for (const route of DEMO_ROUTE_PATHS) {
      for (const stop of route.stops) {
        expect(stop.pathIndex).toBeGreaterThanOrEqual(0);
        expect(stop.pathIndex).toBeLessThan(route.path.length);
      }
    }
  });

  it('initialPathIndex is within path bounds', () => {
    for (const route of DEMO_ROUTE_PATHS) {
      expect(route.initialPathIndex).toBeGreaterThanOrEqual(0);
      expect(route.initialPathIndex).toBeLessThan(route.path.length);
    }
  });

  it('all waypoints are in Bay Area bounds', () => {
    for (const route of DEMO_ROUTE_PATHS) {
      for (const [lat, lng] of route.path) {
        expect(lat).toBeGreaterThan(37.2);
        expect(lat).toBeLessThan(38.1);
        expect(lng).toBeGreaterThan(-122.7);
        expect(lng).toBeLessThan(-121.7);
      }
    }
  });

  it('in_progress route has mix of completed and pending stops', () => {
    const midday = DEMO_ROUTE_PATHS[1];
    const completed = midday.stops.filter(s => s.completed).length;
    const pending = midday.stops.filter(s => !s.completed).length;
    expect(completed).toBeGreaterThan(0);
    expect(pending).toBeGreaterThan(0);
  });
});
