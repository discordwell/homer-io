import { describe, it, expect } from 'vitest';
import { hashAddressBrowser } from './address-hash.js';
import { hashAddress } from '@homer-io/shared/address';

describe('hashAddressBrowser', () => {
  it('produces same hash as server-side hashAddress for a simple address', async () => {
    const addr = { street: '123 Main St', city: 'Denver', state: 'CO', zip: '80202' };
    const browserHash = await hashAddressBrowser(addr);
    const serverHash = hashAddress(addr);
    expect(browserHash).toBe(serverHash);
  });

  it('produces same hash for address with apartment stripped', async () => {
    const addr1 = { street: '100 Broadway Apt 4', city: 'Denver', state: 'CO', zip: '80203' };
    const addr2 = { street: '100 Broadway Apt 7', city: 'Denver', state: 'CO', zip: '80203' };
    const hash1 = await hashAddressBrowser(addr1);
    const hash2 = await hashAddressBrowser(addr2);
    expect(hash1).toBe(hash2);
    // Also matches server
    expect(hash1).toBe(hashAddress(addr1));
  });

  it('is case-insensitive', async () => {
    const addr1 = { street: '123 Main St', city: 'Denver', state: 'CO', zip: '80202' };
    const addr2 = { street: '123 MAIN ST', city: 'DENVER', state: 'co', zip: '80202' };
    const hash1 = await hashAddressBrowser(addr1);
    const hash2 = await hashAddressBrowser(addr2);
    expect(hash1).toBe(hash2);
  });

  it('returns a 64-character hex string', async () => {
    const addr = { street: '456 Oak Ave', city: 'Boulder', state: 'CO', zip: '80301' };
    const hash = await hashAddressBrowser(addr);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('defaults country to "us"', async () => {
    const addr1 = { street: '789 Pine Rd', city: 'Austin', state: 'TX', zip: '78701' };
    const addr2 = { street: '789 Pine Rd', city: 'Austin', state: 'TX', zip: '78701', country: 'US' };
    const hash1 = await hashAddressBrowser(addr1);
    const hash2 = await hashAddressBrowser(addr2);
    expect(hash1).toBe(hash2);
  });
});
