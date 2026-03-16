import { describe, it, expect } from 'vitest';
import { solveTSP, tourDuration, solveCVRPTW } from '../../lib/routing/vrp-solver.js';

describe('solveTSP', () => {
  it('returns empty for no stops', () => {
    expect(solveTSP([], [], undefined)).toEqual([]);
  });

  it('returns single stop unchanged', () => {
    const matrix = [[0, 10], [10, 0]];
    expect(solveTSP(matrix, [1], 0)).toEqual([1]);
  });

  it('returns optimal order for 2 stops with depot', () => {
    // Depot at 0, stops at 1 and 2
    // 0→1 = 5, 0→2 = 10, 1→2 = 3, 2→1 = 3
    const matrix = [
      [0, 5, 10],
      [5, 0, 3],
      [10, 3, 0],
    ];
    const result = solveTSP(matrix, [1, 2], 0);
    // Optimal: depot→1→2 (cost 5+3=8) vs depot→2→1 (cost 10+3=13)
    expect(result).toEqual([1, 2]);
  });

  it('produces deterministic output', () => {
    const matrix = [
      [0, 10, 15, 20],
      [10, 0, 35, 25],
      [15, 35, 0, 30],
      [20, 25, 30, 0],
    ];
    const result1 = solveTSP(matrix, [1, 2, 3], 0);
    const result2 = solveTSP(matrix, [1, 2, 3], 0);
    expect(result1).toEqual(result2);
  });

  it('solves a 5-stop square + center problem correctly', () => {
    // Points arranged as: depot at center, stops at corners of a square
    // Optimal tour visits corners in order (no crossing)
    // Distance matrix for a unit square with center depot:
    //   0: center (0.5, 0.5)
    //   1: (0, 0)  2: (1, 0)  3: (1, 1)  4: (0, 1)
    const d = (x1: number, y1: number, x2: number, y2: number) =>
      Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 1000; // scale up
    const pts: [number, number][] = [[0.5, 0.5], [0, 0], [1, 0], [1, 1], [0, 1]];
    const n = pts.length;
    const matrix: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => d(pts[i][0], pts[i][1], pts[j][0], pts[j][1]))
    );

    const result = solveTSP(matrix, [1, 2, 3, 4], 0);
    const cost = tourDuration(matrix, result, 0);

    // The optimal tour visits corners in sequence (no crossings)
    // Any permutation that visits corners in clockwise/counterclockwise order
    // is optimal: [1,2,3,4] or [4,3,2,1] or any rotation
    // Total cost should be 4 sides (~4000) + depot→first (~707)
    // Crossed tour would be longer
    expect(result).toHaveLength(4);
    expect(new Set(result)).toEqual(new Set([1, 2, 3, 4]));

    // Verify no crossing: cost should be less than a worst-case crossed tour
    const worstTour = [1, 3, 2, 4]; // diagonal crossings
    const worstCost = tourDuration(matrix, worstTour, 0);
    expect(cost).toBeLessThanOrEqual(worstCost);
  });

  it('handles stops without depot', () => {
    const matrix = [
      [0, 5, 10],
      [5, 0, 3],
      [10, 3, 0],
    ];
    const result = solveTSP(matrix, [0, 1, 2]);
    expect(result).toHaveLength(3);
    expect(new Set(result)).toEqual(new Set([0, 1, 2]));
  });
});

describe('tourDuration', () => {
  it('returns 0 for empty tour', () => {
    expect(tourDuration([], [])).toBe(0);
  });

  it('sums sequential legs from depot', () => {
    const matrix = [
      [0, 10, 20],
      [10, 0, 5],
      [20, 5, 0],
    ];
    // depot(0) → 1(10) → 2(5) = 15
    expect(tourDuration(matrix, [1, 2], 0)).toBe(15);
  });
});

describe('solveCVRPTW', () => {
  it('returns empty for no orders', () => {
    const result = solveCVRPTW({
      matrix: [[0]],
      drivers: [{ id: 'd1', matrixIndex: 0, capacity: { weight: 100, volume: 100, count: 100 } }],
      orders: [],
      maxOrdersPerRoute: 50,
    });
    expect(result.assignments).toEqual([]);
    expect(result.unassignedOrderIndices).toEqual([]);
  });

  it('returns all unassigned when no drivers', () => {
    const result = solveCVRPTW({
      matrix: [[0, 10], [10, 0]],
      drivers: [],
      orders: [{ id: 'o1', matrixIndex: 1, demand: { weight: 5, volume: 5, count: 1 }, priority: 2 }],
      maxOrdersPerRoute: 50,
    });
    expect(result.assignments).toEqual([]);
    expect(result.unassignedOrderIndices).toEqual([0]);
  });

  it('assigns orders to nearest driver', () => {
    // Two drivers, two orders — each order is closer to a different driver
    const matrix = [
      [0, 100, 5, 100], // driver 0
      [100, 0, 100, 5], // driver 1
      [5, 100, 0, 100], // order 0 (near driver 0)
      [100, 5, 100, 0], // order 1 (near driver 1)
    ];

    const result = solveCVRPTW({
      matrix,
      drivers: [
        { id: 'd0', matrixIndex: 0, capacity: { weight: 100, volume: 100, count: 100 } },
        { id: 'd1', matrixIndex: 1, capacity: { weight: 100, volume: 100, count: 100 } },
      ],
      orders: [
        { id: 'o0', matrixIndex: 2, demand: { weight: 1, volume: 1, count: 1 }, priority: 2 },
        { id: 'o1', matrixIndex: 3, demand: { weight: 1, volume: 1, count: 1 }, priority: 2 },
      ],
      maxOrdersPerRoute: 50,
    });

    expect(result.unassignedOrderIndices).toEqual([]);
    expect(result.assignments).toHaveLength(2);

    const d0Assignment = result.assignments.find(a => a.driverId === 'd0');
    const d1Assignment = result.assignments.find(a => a.driverId === 'd1');
    expect(d0Assignment?.orderIndices).toEqual([0]); // order 0
    expect(d1Assignment?.orderIndices).toEqual([1]); // order 1
  });

  it('respects capacity constraints', () => {
    const matrix = [
      [0, 5, 5],
      [5, 0, 5],
      [5, 5, 0],
    ];

    const result = solveCVRPTW({
      matrix,
      drivers: [
        { id: 'd0', matrixIndex: 0, capacity: { weight: 10, volume: 0, count: 0 } },
      ],
      orders: [
        { id: 'o0', matrixIndex: 1, demand: { weight: 6, volume: 0, count: 0 }, priority: 2 },
        { id: 'o1', matrixIndex: 2, demand: { weight: 6, volume: 0, count: 0 }, priority: 2 },
      ],
      maxOrdersPerRoute: 50,
    });

    // Driver can only carry 10kg, each order is 6kg — only one fits
    const assigned = result.assignments.flatMap(a => a.orderIndices);
    expect(assigned).toHaveLength(1);
    expect(result.unassignedOrderIndices).toHaveLength(1);
  });

  it('respects maxOrdersPerRoute', () => {
    const n = 4;
    const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 5));
    for (let i = 0; i < n; i++) matrix[i][i] = 0;

    const result = solveCVRPTW({
      matrix,
      drivers: [{ id: 'd0', matrixIndex: 0, capacity: { weight: 0, volume: 0, count: 0 } }],
      orders: [
        { id: 'o0', matrixIndex: 1, demand: { weight: 0, volume: 0, count: 0 }, priority: 2 },
        { id: 'o1', matrixIndex: 2, demand: { weight: 0, volume: 0, count: 0 }, priority: 2 },
        { id: 'o2', matrixIndex: 3, demand: { weight: 0, volume: 0, count: 0 }, priority: 2 },
      ],
      maxOrdersPerRoute: 2,
    });

    const d0 = result.assignments.find(a => a.driverId === 'd0');
    expect(d0!.orderIndices.length).toBeLessThanOrEqual(2);
    expect(result.unassignedOrderIndices).toHaveLength(1);
  });

  it('prioritizes urgent orders', () => {
    const matrix = [
      [0, 10, 10],
      [10, 0, 10],
      [10, 10, 0],
    ];

    const result = solveCVRPTW({
      matrix,
      drivers: [{ id: 'd0', matrixIndex: 0, capacity: { weight: 5, volume: 0, count: 0 } }],
      orders: [
        { id: 'low', matrixIndex: 1, demand: { weight: 3, volume: 0, count: 0 }, priority: 1 },
        { id: 'urgent', matrixIndex: 2, demand: { weight: 3, volume: 0, count: 0 }, priority: 4 },
      ],
      maxOrdersPerRoute: 1,
    });

    // Only 1 spot — urgent should get it
    const assigned = result.assignments.flatMap(a => a.orderIndices);
    expect(assigned).toEqual([1]); // index 1 = urgent order
    expect(result.unassignedOrderIndices).toEqual([0]); // low priority unassigned
  });
});
