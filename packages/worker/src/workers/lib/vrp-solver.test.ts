import { describe, it, expect } from 'vitest';
import { solveTSP, tourDuration } from './vrp-solver.js';

// The worker keeps its own copy of the TSP solver (no cross-package import).
// These tests guard the same open-path 2-opt property the API copy guards, so
// the two implementations can't silently diverge: the optimizer minimizes the
// open delivery path (depot → stop → … with no return leg) and never returns a
// tour that still has a cost-reducing segment reversal.

function bruteForceOptimal(matrix: number[][], stops: number[], depot?: number): number {
  if (stops.length === 0) return 0;
  const permute = (arr: number[]): number[][] =>
    arr.length <= 1
      ? [arr]
      : arr.flatMap((x, i) => permute([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [x, ...p]));
  let best = Infinity;
  for (const perm of permute(stops)) best = Math.min(best, tourDuration(matrix, perm, depot));
  return best;
}

function hasImprovingReversal(matrix: number[][], tour: number[], depot?: number): boolean {
  const base = tourDuration(matrix, tour, depot);
  const firstMovable = depot !== undefined ? 0 : 1;
  for (let p = firstMovable; p < tour.length - 1; p++) {
    for (let q = p + 1; q < tour.length; q++) {
      const candidate = tour.slice();
      let l = p, r = q;
      while (l < r) { const t = candidate[l]; candidate[l] = candidate[r]; candidate[r] = t; l++; r--; }
      if (tourDuration(matrix, candidate, depot) < base - 1e-6) return true;
    }
  }
  return false;
}

function makeRng(seed: number): () => number {
  let s = seed % 0x7fffffff;
  if (s <= 0) s += 0x7fffffff - 1;
  return () => { s = (s * 48271) % 0x7fffffff; return s / 0x7fffffff; };
}

function randomEuclideanMatrix(n: number, rng: () => number): number[][] {
  const pts = Array.from({ length: n }, () => [rng() * 100, rng() * 100] as [number, number]);
  return pts.map(a => pts.map(b => Math.hypot(a[0] - b[0], a[1] - b[1])));
}

describe('worker/vrp-solver solveTSP', () => {
  it('returns a valid permutation of the input stops', () => {
    const matrix = [
      [0, 10, 15, 20],
      [10, 0, 35, 25],
      [15, 35, 0, 30],
      [20, 25, 30, 0],
    ];
    const result = solveTSP(matrix, [1, 2, 3], 0);
    expect(new Set(result)).toEqual(new Set([1, 2, 3]));
  });

  it('improves a nearest-neighbor zigzag to the optimal order', () => {
    // Same instance as the API solver test: NN gives a 1547 zigzag, optimal 1344.
    const matrix = [
      [0, 825, 300, 224, 447],
      [825, 0, 943, 671, 400],
      [300, 943, 0, 283, 640],
      [224, 671, 283, 0, 361],
      [447, 400, 640, 361, 0],
    ];
    const result = solveTSP(matrix, [1, 2, 3, 4], 0);
    const cost = tourDuration(matrix, result, 0);
    expect(cost).toBe(bruteForceOptimal(matrix, [1, 2, 3, 4], 0));
    expect(cost).toBeLessThan(1547);
  });

  it('is a 2-opt local optimum on random instances', () => {
    const rng = makeRng(2026);
    for (let trial = 0; trial < 200; trial++) {
      const n = 4 + Math.floor(rng() * 5);
      const matrix = randomEuclideanMatrix(n + 1, rng);
      const stops = Array.from({ length: n }, (_, i) => i + 1);
      const result = solveTSP(matrix, stops, 0);
      expect(new Set(result)).toEqual(new Set(stops));
      expect(hasImprovingReversal(matrix, result, 0)).toBe(false);
    }
  });
});
