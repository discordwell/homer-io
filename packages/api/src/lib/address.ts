import { createHash } from 'node:crypto';

export interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export interface NormalizedAddress {
  street: string;
  building: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

/**
 * Normalize an address for building-level grouping.
 * Strips unit/apt/suite numbers so "123 Main St Apt 4" and "123 Main St Apt 7"
 * resolve to the same building.
 */
export function normalizeAddress(addr: AddressComponents): NormalizedAddress {
  const street = addr.street?.trim().toLowerCase() ?? '';
  const city = addr.city?.trim().toLowerCase() ?? '';
  const state = addr.state?.trim().toLowerCase() ?? '';
  const zip = addr.zip?.trim() ?? '';
  const country = addr.country?.trim().toLowerCase() || 'us';

  // Strip apartment/unit/suite designators for building-level grouping
  const building = street
    .replace(/\b(apt|apartment|suite|ste|unit|room|rm|fl|floor|dept|department)\b\.?\s*\S*/gi, '')
    .replace(/#\s*\S*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { street, building, city, state, zip, country };
}

/**
 * Generate a SHA-256 hash of normalized address components.
 * Two deliveries to the same building will produce the same hash.
 */
export function hashAddress(addr: AddressComponents): string {
  const normalized = normalizeAddress(addr);
  const key = [normalized.building, normalized.city, normalized.state, normalized.zip, normalized.country].join('|');
  return createHash('sha256').update(key).digest('hex');
}
