import { describe, it, expect } from 'vitest';
import { pathLength, interpolatePath, generateSyntheticPath } from './driverAnimator.js';

describe('pathLength', () => {
  it('returns 0 for empty path', () => {
    expect(pathLength([])).toBe(0);
  });

  it('returns 0 for single point', () => {
    expect(pathLength([[0, 0]])).toBe(0);
  });

  it('calculates correct length for horizontal line', () => {
    const pts: [number, number][] = [[0, 0], [10, 0]];
    expect(pathLength(pts)).toBe(10);
  });

  it('calculates correct length for diagonal', () => {
    const pts: [number, number][] = [[0, 0], [3, 4]];
    expect(pathLength(pts)).toBe(5);
  });

  it('sums multi-segment path', () => {
    const pts: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    expect(pathLength(pts)).toBe(20);
  });
});

describe('interpolatePath', () => {
  it('returns [0,0] for empty path', () => {
    expect(interpolatePath([], 0.5)).toEqual([0, 0]);
  });

  it('returns the single point for single-point path', () => {
    expect(interpolatePath([[5, 5]], 0.5)).toEqual([5, 5]);
  });

  it('returns start at t=0', () => {
    const pts: [number, number][] = [[0, 0], [10, 0]];
    const result = interpolatePath(pts, 0);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0);
  });

  it('returns end at t=1', () => {
    const pts: [number, number][] = [[0, 0], [10, 0]];
    const result = interpolatePath(pts, 1);
    expect(result[0]).toBeCloseTo(10);
    expect(result[1]).toBeCloseTo(0);
  });

  it('returns midpoint at t=0.5 on straight line', () => {
    const pts: [number, number][] = [[0, 0], [10, 0]];
    const result = interpolatePath(pts, 0.5);
    expect(result[0]).toBeCloseTo(5);
    expect(result[1]).toBeCloseTo(0);
  });

  it('interpolates correctly on multi-segment path', () => {
    // Two equal segments: (0,0)->(10,0)->(10,10), total length 20
    const pts: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    // At t=0.25 => distance 5 => on first segment at (5,0)
    const result = interpolatePath(pts, 0.25);
    expect(result[0]).toBeCloseTo(5);
    expect(result[1]).toBeCloseTo(0);
    // At t=0.75 => distance 15 => on second segment at (10,5)
    const result2 = interpolatePath(pts, 0.75);
    expect(result2[0]).toBeCloseTo(10);
    expect(result2[1]).toBeCloseTo(5);
  });

  it('uses precomputed totalLength when provided', () => {
    const pts: [number, number][] = [[0, 0], [10, 0]];
    const cachedLen = pathLength(pts);
    const result = interpolatePath(pts, 0.5, cachedLen);
    expect(result[0]).toBeCloseTo(5);
    expect(result[1]).toBeCloseTo(0);
  });
});

describe('generateSyntheticPath', () => {
  it('generates 31 points', () => {
    const pts = generateSyntheticPath(1000, 800);
    expect(pts).toHaveLength(31);
  });

  it('generates points within reasonable bounds', () => {
    const w = 1000, h = 800;
    const pts = generateSyntheticPath(w, h);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThan(-w);
      expect(x).toBeLessThan(w * 2);
      expect(y).toBeGreaterThan(-h);
      expect(y).toBeLessThan(h * 2);
    }
  });

  it('generates path with non-zero length', () => {
    const pts = generateSyntheticPath(1000, 800);
    expect(pathLength(pts)).toBeGreaterThan(0);
  });
});
