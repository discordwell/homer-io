import { vehicleSpeedsKmh, dwellTimesMinutes } from '@homer-io/shared';

/**
 * Haversine distance in km between two lat/lng points.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
