import { describe, it, expect } from 'vitest';
import { generateDemoVehicles, generateDemoDriverNames, generateDemoOrders, BAY_AREA_LOCATIONS } from '../modules/auth/demo-seed.js';

describe('Demo seed - data generation', () => {
  it('generates 4 vehicles with Bay Area context', () => {
    const vehicles = generateDemoVehicles();
    expect(vehicles).toHaveLength(4);
    vehicles.forEach(v => {
      expect(v.name).toBeDefined();
      expect(['car', 'van', 'truck', 'cargo_bike']).toContain(v.type);
    });
  });

  it('generates 5 driver names', () => {
    const names = generateDemoDriverNames();
    expect(names).toHaveLength(5);
    names.forEach(n => expect(n.length).toBeGreaterThan(0));
  });

  it('generates orders with today timestamps', () => {
    const orders = generateDemoOrders();
    const today = new Date().toISOString().slice(0, 10);
    expect(orders.length).toBeGreaterThanOrEqual(15);
    expect(orders.length).toBeLessThanOrEqual(20);
    orders.forEach(o => {
      expect(o.recipientName).toBeDefined();
      expect(o.deliveryAddress).toBeDefined();
      expect(o.deliveryLat).toBeDefined();
      expect(o.deliveryLng).toBeDefined();
      expect(o.createdAt.toISOString().slice(0, 10)).toBe(today);
    });
  });

  it('has realistic Bay Area locations', () => {
    expect(BAY_AREA_LOCATIONS.length).toBeGreaterThanOrEqual(20);
    BAY_AREA_LOCATIONS.forEach(loc => {
      expect(loc.lat).toBeGreaterThan(37.2);
      expect(loc.lat).toBeLessThan(38.0);
      expect(loc.lng).toBeGreaterThan(-122.6);
      expect(loc.lng).toBeLessThan(-121.7);
    });
  });
});
