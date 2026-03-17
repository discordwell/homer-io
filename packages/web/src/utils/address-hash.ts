import type { AddressComponents } from '@homer-io/shared';

function normalizeAddressBrowser(addr: AddressComponents) {
  const street = addr.street?.trim().toLowerCase() ?? '';
  const city = addr.city?.trim().toLowerCase() ?? '';
  const state = addr.state?.trim().toLowerCase() ?? '';
  const zip = addr.zip?.trim() ?? '';
  const country = addr.country?.trim().toLowerCase() || 'us';

  const building = street
    .replace(/\b(apt|apartment|suite|ste|unit|room|rm|fl|floor|dept|department)\b\.?\s*\S*/gi, '')
    .replace(/#\s*\S*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { building, city, state, zip, country };
}

/**
 * Browser-compatible address hashing using Web Crypto API.
 * Produces identical output to the server-side hashAddress from @homer-io/shared.
 */
export async function hashAddressBrowser(addr: AddressComponents): Promise<string> {
  const normalized = normalizeAddressBrowser(addr);
  const key = [normalized.building, normalized.city, normalized.state, normalized.zip, normalized.country].join('|');
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
