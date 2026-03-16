import { vehicleSpeedsKmh, dwellTimesMinutes, haversineDistance } from '@homer-io/shared';

// Re-export so existing consumers don't break
export { haversineDistance };

/**
 * Estimate ETA in minutes from point A to B for a given vehicle type.
 * Formula: (haversine x 1.3 road correction) / speed x 60 + dwellTimeMinutes
 */
export function estimateEtaMinutes(
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
  const dwell = dwellTimesMinutes[type] ?? dwellTimesMinutes.car;

  const travelMinutes = (roadDistance / speed) * 60;
  return Math.round((travelMinutes + dwell) * 10) / 10;
}
