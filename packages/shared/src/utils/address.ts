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

  // Strip apartment/unit/suite designators for building-level grouping.
  // Connectors (Shopify/WooCommerce/Square/Toast) join address line1/line2 with
  // ", ", so stripping a unit from "123 Main St, Apt 4" would otherwise leave a
  // dangling comma ("123 main st,"), hashing differently from the manually-typed
  // "123 Main St Apt 4" ("123 main st") and fragmenting per-building dedup.
  // Treat commas as separators so both forms collapse to the same building.
  const building = street
    .replace(/\b(apt|apartment|suite|ste|unit|room|rm|fl|floor|dept|department)\b\.?\s*\S*/gi, '')
    .replace(/#\s*\S*/g, '')
    .replace(/,/g, ' ')
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

/**
 * Failure categories for delivery failures.
 * Used by the learning worker for auto-classification and by the DB enum.
 */
export const FAILURE_CATEGORIES = [
  'not_home', 'wrong_address', 'access_denied', 'refused',
  'damaged', 'business_closed', 'weather', 'vehicle_issue', 'other',
] as const;

export type FailureCategory = typeof FAILURE_CATEGORIES[number];
