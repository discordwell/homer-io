import { normalizeAddress, type AddressComponents } from '@homer-io/shared';

/**
 * Browser-compatible address hashing using Web Crypto API.
 * Produces identical output to the server-side hashAddress from @homer-io/shared.
 */
export async function hashAddressBrowser(addr: AddressComponents): Promise<string> {
  const normalized = normalizeAddress(addr);
  const key = [normalized.building, normalized.city, normalized.state, normalized.zip, normalized.country].join('|');
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
