import { describe, it, expect } from 'vitest';
import { fuelConsumption, co2PerLiter, carbonOverviewSchema } from '@homer-io/shared';

describe('Carbon tracking', () => {
  it('has correct fuel consumption values', () => {
    expect(fuelConsumption.car.gasoline).toBe(8.5);
    expect(fuelConsumption.van.diesel).toBe(9.0);
    expect(fuelConsumption.bike.gasoline).toBe(0); // bikes have no fuel
    expect(fuelConsumption.car.electric).toBe(0); // EVs have no fuel consumption
  });

  it('has correct CO2 per liter values', () => {
    expect(co2PerLiter.gasoline).toBe(2.31);
    expect(co2PerLiter.diesel).toBe(2.68);
    expect(co2PerLiter.electric).toBe(0);
  });

  it('calculates carbon correctly for gas car', () => {
    const distanceKm = 100;
    const liters = (distanceKm / 100) * fuelConsumption.car.gasoline;
    const co2Kg = liters * co2PerLiter.gasoline;
    expect(co2Kg).toBeCloseTo(19.635, 1); // 8.5 * 2.31 = 19.635
  });

  it('calculates zero carbon for electric vehicles', () => {
    const distanceKm = 100;
    const liters = (distanceKm / 100) * fuelConsumption.car.electric;
    const co2Kg = liters * co2PerLiter.electric;
    expect(co2Kg).toBe(0);
  });

  it('calculates zero carbon for bikes', () => {
    const distanceKm = 50;
    const liters = (distanceKm / 100) * fuelConsumption.bike.gasoline;
    const co2Kg = liters * co2PerLiter.gasoline;
    expect(co2Kg).toBe(0);
  });

  it('validates carbon overview schema', () => {
    const valid = carbonOverviewSchema.parse({
      totalCo2Kg: 150.5,
      totalDistanceKm: 1200,
      routeCount: 45,
      evSavingsKg: 25.3,
      greenDeliveryPercent: 18,
      avgCo2PerRouteKg: 3.34,
    });
    expect(valid.totalCo2Kg).toBe(150.5);
    expect(valid.greenDeliveryPercent).toBe(18);
  });
});
