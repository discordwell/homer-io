import { describe, it, expect } from 'vitest';
import { haversineDistance, estimateEtaMinutes } from '../lib/geo.js';

describe('Geo utilities', () => {
  describe('haversineDistance', () => {
    it('calculates distance between two points', () => {
      // NYC to LA approx 3,944 km
      const dist = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(dist).toBeGreaterThan(3900);
      expect(dist).toBeLessThan(4000);
    });

    it('returns 0 for same point', () => {
      const dist = haversineDistance(51.5074, -0.1278, 51.5074, -0.1278);
      expect(dist).toBe(0);
    });

    it('handles close points (< 1km)', () => {
      // Two points ~0.5km apart
      const dist = haversineDistance(51.5074, -0.1278, 51.5080, -0.1200);
      expect(dist).toBeGreaterThan(0.4);
      expect(dist).toBeLessThan(1);
    });
  });

  describe('estimateEtaMinutes', () => {
    it('calculates ETA for car between two close points', () => {
      // ~1km apart
      const eta = estimateEtaMinutes(51.5074, -0.1278, 51.5100, -0.1200, 'car');
      // 1km * 1.3 / 30 km/h * 60 + 3 min dwell ≈ 5.6 min
      expect(eta).toBeGreaterThan(3);
      expect(eta).toBeLessThan(10);
    });

    it('uses different speeds for different vehicle types', () => {
      const carEta = estimateEtaMinutes(51.5074, -0.1278, 51.5200, -0.1000, 'car');
      const bikeEta = estimateEtaMinutes(51.5074, -0.1278, 51.5200, -0.1000, 'bike');
      const truckEta = estimateEtaMinutes(51.5074, -0.1278, 51.5200, -0.1000, 'truck');

      // Bikes are slower than cars but have less dwell time
      // Trucks are slowest with most dwell
      expect(bikeEta).toBeGreaterThan(carEta); // bikes are slower
      expect(truckEta).toBeGreaterThan(carEta); // trucks are slower
    });

    it('includes dwell time even for zero distance', () => {
      const eta = estimateEtaMinutes(51.5074, -0.1278, 51.5074, -0.1278, 'car');
      expect(eta).toBeGreaterThan(0); // Should have dwell time
    });

    it('falls back to car for unknown vehicle type', () => {
      const unknownEta = estimateEtaMinutes(51.5074, -0.1278, 51.5200, -0.1000, 'spaceship');
      const carEta = estimateEtaMinutes(51.5074, -0.1278, 51.5200, -0.1000, 'car');
      expect(unknownEta).toBe(carEta);
    });
  });
});
