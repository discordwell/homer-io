import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Node's dns.promises BEFORE importing the module under test, so the
// module picks up the mocked version. Vitest hoists vi.mock calls.
vi.mock('dns', async () => {
  const actual = await vi.importActual<typeof import('dns')>('dns');
  return {
    ...actual,
    promises: {
      lookup: vi.fn(),
    },
  };
});

import { promises as dns } from 'dns';
import {
  assertUrlIsSafe,
  isBlockedIp,
  isBlockedHostSync,
  getPlatformHostPolicy,
  checkPlatformHost,
} from './safe-url.js';

const lookupMock = dns.lookup as unknown as ReturnType<typeof vi.fn>;

function mockLookup(addresses: Array<{ address: string; family: number }> | Error) {
  if (addresses instanceof Error) {
    lookupMock.mockRejectedValueOnce(addresses);
  } else {
    lookupMock.mockResolvedValueOnce(addresses);
  }
}

beforeEach(() => {
  lookupMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('isBlockedIp — IPv4 ranges', () => {
  it.each([
    ['0.0.0.0', true],
    ['10.0.0.1', true],
    ['10.255.255.255', true],
    ['100.64.0.1', true],
    ['100.127.255.255', true],
    ['127.0.0.1', true],
    ['127.1.2.3', true],
    ['169.254.169.254', true], // AWS/GCP metadata
    ['169.254.0.5', true],
    ['172.15.0.1', false], // just below /12
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['172.32.0.1', false], // just above /12
    ['192.168.1.1', true],
    ['192.168.255.255', true],
    ['198.18.0.1', true], // benchmarking
    ['224.0.0.1', true], // multicast
    ['239.255.255.255', true],
    ['240.0.0.1', true], // reserved
    ['255.255.255.255', true],
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['203.0.114.1', false], // just outside TEST-NET-3
  ])('isBlockedIp(%s) === %s', (ip, expected) => {
    expect(isBlockedIp(ip)).toBe(expected);
  });
});

describe('isBlockedIp — IPv6 ranges', () => {
  it.each([
    ['::1', true],
    ['::', true],
    ['fe80::1', true], // link-local
    ['fc00::1', true], // unique-local
    ['fd00::5', true],
    ['ff02::1', true], // multicast
    ['::ffff:127.0.0.1', true], // IPv4-mapped loopback
    ['::ffff:8.8.8.8', false], // IPv4-mapped public
    ['2606:4700:4700::1111', false], // Cloudflare DNS
    ['2001:4860:4860::8888', false], // Google DNS
  ])('isBlockedIp(%s) === %s', (ip, expected) => {
    expect(isBlockedIp(ip)).toBe(expected);
  });
});

describe('isBlockedHostSync', () => {
  it('blocks "localhost"', () => {
    expect(isBlockedHostSync('localhost')).toBe(true);
  });
  it('blocks "LOCALHOST" (case-insensitive)', () => {
    expect(isBlockedHostSync('LOCALHOST')).toBe(true);
  });
  it('blocks "foo.localhost"', () => {
    expect(isBlockedHostSync('foo.localhost')).toBe(true);
  });
  it('blocks cloud metadata names', () => {
    expect(isBlockedHostSync('metadata.google.internal')).toBe(true);
    expect(isBlockedHostSync('metadata.goog')).toBe(true);
  });
  it('does NOT block arbitrary attacker-controlled names here (DNS lookup handles those)', () => {
    // "localhost.attacker.com" is a real public hostname; the sync check
    // should NOT claim it is a named-loopback.
    expect(isBlockedHostSync('localhost.attacker.com')).toBe(false);
  });
  it('blocks literal private IPs passed as hostname', () => {
    expect(isBlockedHostSync('192.168.1.1')).toBe(true);
    expect(isBlockedHostSync('10.0.0.1')).toBe(true);
  });
  it('allows public IPs via sync check', () => {
    expect(isBlockedHostSync('8.8.8.8')).toBe(false);
  });
  it('handles bracketed IPv6 hostname form', () => {
    expect(isBlockedHostSync('[::1]')).toBe(true);
    expect(isBlockedHostSync('[fe80::1]')).toBe(true);
  });
  it('rejects empty hostname', () => {
    expect(isBlockedHostSync('')).toBe(true);
    expect(isBlockedHostSync('   ')).toBe(true);
  });
});

describe('assertUrlIsSafe — scheme filtering', () => {
  it.each([
    ['http://example.com/webhook', 'http:'],
    ['ftp://example.com/file', 'ftp:'],
    ['file:///etc/passwd', 'file:'],
    ['gopher://example.com:70/_x', 'gopher:'],
    ['data:text/plain,hi', 'data:'],
    ['ws://example.com/socket', 'ws:'],
  ])('rejects %s (scheme)', async (url) => {
    const res = await assertUrlIsSafe(url);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toMatch(/scheme/i);
    }
  });

  it('rejects malformed URL string', async () => {
    const res = await assertUrlIsSafe('not a url at all');
    expect(res.ok).toBe(false);
  });
});

describe('assertUrlIsSafe — literal private IPs', () => {
  it.each([
    'https://127.0.0.1/',
    'https://10.0.0.1/',
    'https://192.168.1.1/admin',
    'https://169.254.169.254/latest/meta-data/',
    'https://172.16.0.1/',
    'https://[::1]/',
    'https://[fe80::1]/',
    'https://0.0.0.0/',
  ])('rejects %s', async (url) => {
    const res = await assertUrlIsSafe(url);
    expect(res.ok).toBe(false);
    // Literal IP path should NOT require DNS.
    expect(lookupMock).not.toHaveBeenCalled();
  });
});

describe('assertUrlIsSafe — userinfo', () => {
  it('rejects URL with embedded credentials', async () => {
    const res = await assertUrlIsSafe('https://user:pass@example.com/');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/userinfo|credentials/i);
  });
});

describe('assertUrlIsSafe — DNS-resolved private IPs', () => {
  it('rejects a public-looking hostname that resolves to a private IP', async () => {
    mockLookup([{ address: '192.168.1.10', family: 4 }]);
    const res = await assertUrlIsSafe('https://evil.attacker.com/webhook');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/private|loopback|internal/i);
    expect(lookupMock).toHaveBeenCalledTimes(1);
  });

  it('rejects when ANY resolved address is private (multi-record)', async () => {
    mockLookup([
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.5', family: 4 }, // one poisoned record is enough
    ]);
    const res = await assertUrlIsSafe('https://rebind.attacker.com/x');
    expect(res.ok).toBe(false);
  });

  it('rejects a hostname that resolves to an IPv6 link-local', async () => {
    mockLookup([{ address: 'fe80::1', family: 6 }]);
    const res = await assertUrlIsSafe('https://evil6.attacker.com/');
    expect(res.ok).toBe(false);
  });

  it('accepts a hostname that resolves only to public IPs', async () => {
    mockLookup([{ address: '8.8.8.8', family: 4 }]);
    const res = await assertUrlIsSafe('https://public.example.com/webhook');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.url.hostname).toBe('public.example.com');
  });

  it('rejects when DNS lookup fails (fail-closed)', async () => {
    mockLookup(new Error('ENOTFOUND'));
    const res = await assertUrlIsSafe('https://does-not-exist.invalid/');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/dns/i);
  });

  it('rejects when DNS resolves to zero addresses', async () => {
    mockLookup([]);
    const res = await assertUrlIsSafe('https://empty.example.com/');
    expect(res.ok).toBe(false);
  });
});

describe('assertUrlIsSafe — IDN / punycode handling', () => {
  it('does not let "localhost.attacker.com" bypass as a loopback name', async () => {
    // The named-loopback check is strict: "localhost" or exact suffix only.
    // For "localhost.attacker.com", we proceed to DNS — mock a public IP and
    // verify the URL is accepted (DNS is the authority here). Point is:
    // there must be no sync-path false negative that treats this as blocked,
    // and no false positive that treats it as localhost.
    mockLookup([{ address: '8.8.8.8', family: 4 }]);
    const res = await assertUrlIsSafe('https://localhost.attacker.com/x');
    expect(res.ok).toBe(true);
  });

  it('handles IDN punycode hostname without bypass (URL normalizes to ASCII)', async () => {
    // "xn--..." is the punycode form. The URL parser stores it as-is.
    mockLookup([{ address: '192.168.1.1', family: 4 }]);
    const res = await assertUrlIsSafe('https://xn--fiq228c.example/');
    expect(res.ok).toBe(false);
  });

  it('rejects a hostname that literally punycodes to "localhost" (defensive)', async () => {
    // Direct literal "localhost" — covered, but check once more via URL.
    const res = await assertUrlIsSafe('https://localhost/foo');
    expect(res.ok).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });
});

describe('getPlatformHostPolicy / checkPlatformHost', () => {
  it('returns null for platforms without a canonical host (woocommerce)', () => {
    expect(getPlatformHostPolicy('woocommerce')).toBeNull();
    expect(checkPlatformHost('woocommerce', 'https://anystore.example.com')).toBeNull();
  });

  it('shopify requires *.myshopify.com', () => {
    expect(checkPlatformHost('shopify', 'https://coolstore.myshopify.com')).toBeNull();
    expect(checkPlatformHost('shopify', 'https://attacker.com')).not.toBeNull();
    expect(checkPlatformHost('shopify', 'https://myshopify.com.attacker.com')).not.toBeNull();
  });

  it('rejects malformed URL via checkPlatformHost', () => {
    expect(checkPlatformHost('shopify', 'not a url')).not.toBeNull();
  });

  it('dutchie accepts dutchie.com subdomains', () => {
    expect(checkPlatformHost('dutchie', 'https://store.dutchie.com')).toBeNull();
    expect(checkPlatformHost('dutchie', 'https://store.iheartjane.com')).toBeNull();
    expect(checkPlatformHost('dutchie', 'https://attacker.com')).not.toBeNull();
  });

  it('unknown platform returns null (no restriction)', () => {
    expect(checkPlatformHost('totally-unknown', 'https://anywhere.example/')).toBeNull();
  });
});
