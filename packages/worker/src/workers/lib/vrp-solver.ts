/**
 * Inline TSP solver for the worker package.
 * Same algorithm as packages/api/src/lib/routing/vrp-solver.ts
 * (nearest-neighbor + 2-opt). Inlined to avoid cross-package rootDir issues.
 */

export function solveTSP(
  matrix: number[][],
  stopIndices: number[],
  depotIndex?: number,
): number[] {
  if (stopIndices.length <= 1) return [...stopIndices];
  if (stopIndices.length === 2) {
    const [a, b] = stopIndices;
    const start = depotIndex ?? a;
    const costAB = matrix[start][a] + matrix[a][b];
    const costBA = matrix[start][b] + matrix[b][a];
    return costAB <= costBA ? [a, b] : [b, a];
  }

  const tour = nearestNeighbor(matrix, stopIndices, depotIndex);
  return twoOpt(matrix, tour, depotIndex);
}

export function tourDuration(
  matrix: number[][],
  tour: number[],
  depotIndex?: number,
): number {
  if (tour.length === 0) return 0;
  let total = 0;
  let prev = depotIndex ?? tour[0];
  for (const stop of tour) {
    if (stop === prev && depotIndex === undefined) continue;
    total += matrix[prev][stop];
    prev = stop;
  }
  return total;
}

function nearestNeighbor(
  matrix: number[][],
  stopIndices: number[],
  depotIndex?: number,
): number[] {
  const remaining = new Set(stopIndices);
  const tour: number[] = [];
  let current = depotIndex ?? stopIndices[0];

  if (depotIndex !== undefined && remaining.has(depotIndex)) {
    tour.push(depotIndex);
    remaining.delete(depotIndex);
  }

  while (remaining.size > 0) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (const idx of remaining) {
      const dist = matrix[current][idx];
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = idx;
      }
    }
    tour.push(nearest);
    remaining.delete(nearest);
    current = nearest;
  }

  return tour;
}

// Open-path 2-opt: optimizes the depot → stop → … path with no return leg,
// matching tourDuration. Reversing seq[p+1..q] only changes its boundary edges
// (interior length is preserved for a symmetric matrix), so each move is O(1).
// The depot, when present, is a fixed anchor at the head and never reordered.
// For a symmetric matrix every accepted move strictly lowers cost, so the result
// is at least as good as the input tour (OSRM's slight asymmetry can rarely make
// a counted gain marginally non-improving). Keep this identical to packages/api.
function twoOpt(
  matrix: number[][],
  tour: number[],
  depotIndex?: number,
): number[] {
  if (tour.length < 2) return tour;

  const seq = depotIndex !== undefined ? [depotIndex, ...tour] : [...tour];
  const m = seq.length;
  const EPS = 1e-9;
  let improved = true;
  let iterations = 0;

  while (improved && iterations < 1000) {
    improved = false;
    iterations++;

    for (let p = 0; p < m - 2; p++) {
      const anchor = seq[p];
      for (let q = p + 2; q < m; q++) {
        const segStart = seq[p + 1];
        const segEnd = seq[q];
        const hasTail = q < m - 1;
        const tail = hasTail ? seq[q + 1] : -1;

        const oldCost = matrix[anchor][segStart] + (hasTail ? matrix[segEnd][tail] : 0);
        const newCost = matrix[anchor][segEnd] + (hasTail ? matrix[segStart][tail] : 0);

        if (newCost - oldCost < -EPS) {
          let left = p + 1;
          let right = q;
          while (left < right) {
            const tmp = seq[left];
            seq[left] = seq[right];
            seq[right] = tmp;
            left++;
            right--;
          }
          improved = true;
        }
      }
    }
  }

  return depotIndex !== undefined ? seq.slice(1) : seq;
}
