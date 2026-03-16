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

function twoOpt(
  matrix: number[][],
  tour: number[],
  depotIndex?: number,
): number[] {
  const n = tour.length;
  if (n < 3) return tour;

  const result = [...tour];
  let improved = true;
  let iterations = 0;

  while (improved && iterations < 1000) {
    improved = false;
    iterations++;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        const beforeI = i === 0 && depotIndex !== undefined ? depotIndex : result[i > 0 ? i - 1 : n - 1];
        const afterJ = j < n - 1 ? result[j + 1] : (depotIndex !== undefined ? depotIndex : result[0]);

        const oldCost = matrix[beforeI][result[i]] + matrix[result[j]][afterJ];
        const newCost = matrix[beforeI][result[j]] + matrix[result[i]][afterJ];

        if (newCost - oldCost < -0.001) {
          let left = i;
          let right = j;
          while (left < right) {
            const tmp = result[left];
            result[left] = result[right];
            result[right] = tmp;
            left++;
            right--;
          }
          improved = true;
        }
      }
    }
  }

  return result;
}
