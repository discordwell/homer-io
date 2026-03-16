import { describe, it, expect } from 'vitest';
import { normalizeAddress, hashAddress } from '../lib/address.js';

describe('Address utilities', () => {
  describe('normalizeAddress', () => {
    it('lowercases and trims all components', () => {
      const result = normalizeAddress({
        street: '  123 Main Street  ',
        city: '  New York  ',
        state: '  NY  ',
        zip: '10001',
        country: '  US  ',
      });
      expect(result.street).toBe('123 main street');
      expect(result.city).toBe('new york');
      expect(result.state).toBe('ny');
      expect(result.zip).toBe('10001');
      expect(result.country).toBe('us');
    });

    it('strips apartment/unit for building-level grouping', () => {
      const result = normalizeAddress({
        street: '123 Main St Apt 4B',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
      });
      expect(result.building).toBe('123 main st');
    });

    it('strips suite designator', () => {
      const result = normalizeAddress({
        street: '450 Oak Avenue Suite 200',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
      });
      expect(result.building).toBe('450 oak avenue');
    });

    it('strips unit with hash prefix', () => {
      const result = normalizeAddress({
        street: '789 Pine Rd #12',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
      });
      expect(result.building).toBe('789 pine rd');
    });

    it('strips floor designator', () => {
      const result = normalizeAddress({
        street: '100 Broadway Fl 5',
        city: 'Denver',
        state: 'CO',
        zip: '80201',
      });
      expect(result.building).toBe('100 broadway');
    });

    it('preserves street with no unit', () => {
      const result = normalizeAddress({
        street: '555 Elm Drive',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
      });
      expect(result.building).toBe('555 elm drive');
    });

    it('defaults country to us', () => {
      const result = normalizeAddress({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
      });
      expect(result.country).toBe('us');
    });
  });

  describe('hashAddress', () => {
    it('produces consistent hash for same address', () => {
      const addr = { street: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' };
      expect(hashAddress(addr)).toBe(hashAddress(addr));
    });

    it('produces same hash for different apartments at same building', () => {
      const apt4 = { street: '123 Main St Apt 4', city: 'Portland', state: 'OR', zip: '97201' };
      const apt7 = { street: '123 Main St Apt 7', city: 'Portland', state: 'OR', zip: '97201' };
      expect(hashAddress(apt4)).toBe(hashAddress(apt7));
    });

    it('produces different hash for different buildings', () => {
      const addr1 = { street: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' };
      const addr2 = { street: '456 Oak Ave', city: 'Portland', state: 'OR', zip: '97201' };
      expect(hashAddress(addr1)).not.toBe(hashAddress(addr2));
    });

    it('produces different hash for same street in different cities', () => {
      const addr1 = { street: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' };
      const addr2 = { street: '123 Main St', city: 'Seattle', state: 'WA', zip: '98101' };
      expect(hashAddress(addr1)).not.toBe(hashAddress(addr2));
    });

    it('is case-insensitive', () => {
      const lower = { street: '123 main st', city: 'portland', state: 'or', zip: '97201' };
      const upper = { street: '123 MAIN ST', city: 'PORTLAND', state: 'OR', zip: '97201' };
      expect(hashAddress(lower)).toBe(hashAddress(upper));
    });

    it('handles extra whitespace', () => {
      const trimmed = { street: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' };
      const padded = { street: '  123 Main St  ', city: '  Portland  ', state: '  OR  ', zip: '97201' };
      expect(hashAddress(trimmed)).toBe(hashAddress(padded));
    });

    it('returns a 64-character hex string (SHA-256)', () => {
      const hash = hashAddress({ street: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' });
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
