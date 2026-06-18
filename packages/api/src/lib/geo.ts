import { vehicleSpeedsKmh, dwellTimesMinutes, haversineDistance } from '@homer-io/shared';

// Re-export so existing consumers don't break
export { haversineDistance };

/**
 * Estimate driving time in minutes from point A to B for a given vehicle type.
 * Travel time ONLY — does not include dwell/service time at the destination.
 * Formula: (haversine x 1.3 road correction) / speed x 60
 *
 * Use this (not estimateEtaMinutes) when the dwell time is added separately by
 * the caller — e.g. the per-leg durations fed to buildEtaResult, which adds the
 * stop's dwell itself. Folding dwell in here too would double-count it per stop.
 */
export function estimateTravelMinutes(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  vehicleType: string,
): number {
  const distance = haversineDistance(fromLat, fromLng, toLat, toLng);
  const roadDistance = distance * 1.3;

  const type = vehicleType as keyof typeof vehicleSpeedsKmh;
  const speed = vehicleSpeedsKmh[type] ?? vehicleSpeedsKmh.car;

  const travelMinutes = (roadDistance / speed) * 60;
  return Math.round(travelMinutes * 10) / 10;
}

/**
 * Estimate ETA in minutes from point A to B for a given vehicle type.
 * Formula: travelMinutes + dwellTimeMinutes (dwell at the destination stop).
 */
export function estimateEtaMinutes(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  vehicleType: string,
): number {
  const type = vehicleType as keyof typeof dwellTimesMinutes;
  const dwell = dwellTimesMinutes[type] ?? dwellTimesMinutes.car;
  const travelMinutes = estimateTravelMinutes(fromLat, fromLng, toLat, toLng, vehicleType);
  return Math.round((travelMinutes + dwell) * 10) / 10;
}
