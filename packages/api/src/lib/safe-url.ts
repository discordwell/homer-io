/**
 * SSRF-safe URL validation.
 *
 * Rejects URLs that could be used to probe internal services or exfiltrate
 * credentials. Used by both the webhook create/update path and the integration
 * connection create/update path. Also used (in a sync form) by the webhook
 * delivery worker as a second line of defense.
 *
 * IMPORTANT: DNS can change between create-time validation and delivery-time
 * use (DNS-rebinding / TOCTOU). Callers at delivery time MUST re-check with a
 * fast literal-IP check on whatever hostname they are about to contact; do NOT
 * rely on the create-time check alone. See `isBlockedHostSync` for that.
 */
import { promises as dns } from 'dns';
import { isIP } from 'net';

export type SafeUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/** Allowed URL schemes. HTTP is not allowed for webhooks/integrations. */
const ALLOWED_SCHEMES = new Set(['https:']);

/**
 * Check whether a literal IP address string is in a blocked range.
 * Covers IPv4 loopback, private (RFC1918), link-local, CGNAT, and multicast;
 * and IPv6 loopback, link-local, unique-local, and mapped IPv4 variants.
 */
export function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isBlockedIpv4(ip);
  if (v === 6) return isBlockedIpv6(ip);
  return false;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) {
    // Malformed — treat as blocked to fail closed.
    return true;
  }
  const [a, b] = parts;
  // 0.0.0.0/8 — "this network"
  if (a === 0) return true;
  // 10.0.0.0/8 — RFC1918
  if (a === 10) return true;
  // 100.64.0.0/10 — CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 169.254.0.0/16 — link-local (includes AWS/GCP metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 — RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 — IETF protocol assignments
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  // 192.0.2.0/24 — TEST-NET-1 (documentation)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 — RFC1918
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 — benchmarking
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 — TEST-NET-2
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 — TEST-NET-3
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 — multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 — reserved (includes 255.255.255.255)
  if (a >= 240) return true;
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // Loopback ::1
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  // Unspecified ::
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
  // IPv4-mapped ::ffff:x.x.x.x — extract the embedded v4 and check it
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) {
    return isBlockedIpv4(mapped[1]);
  }
  // IPv4-mapped ::ffff:a:b hex form — expand to v4
  const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isBlockedIpv4(v4);
  }
  // fe80::/10 — link-local
  if (/^fe[89ab][0-9a-f]?:/.test(lower)) return true;
  // fc00::/7 — unique-local (fc.. or fd..)
  if (/^f[cd][0-9a-f]{0,2}:/.test(lower)) return true;
  // ff00::/8 — multicast
  if (/^ff[0-9a-f]{0,2}:/.test(lower)) return true;
  return false;
}

/**
 * Synchronous host check — tests the literal hostname without DNS.
 * Use this at delivery time (after create-time validation) to avoid TOCTOU
 * from DNS rebinding. Also used inside `assertUrlIsSafe` before DNS lookup.
 */
export function isBlockedHostSync(hostnameRaw: string): boolean {
  const hostname = hostnameRaw.trim().toLowerCase();
  if (!hostname) return true;

  // Strip IPv6 brackets if any: [::1] -> ::1
  const unbracketed = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  // Named loopback / metadata targets.
  if (
    unbracketed === 'localhost' ||
    unbracketed.endsWith('.localhost') ||
    unbracketed === 'ip6-localhost' ||
    unbracketed === 'ip6-loopback' ||
    unbracketed === 'metadata.google.internal' ||
    unbracketed === 'metadata.goog'
  ) {
    return true;
  }

  // Literal IP? Check it directly.
  if (isIP(unbracketed)) {
    return isBlockedIp(unbracketed);
  }
  return false;
}

/**
 * Validate a URL for safe outbound requests.
 *
 * Checks:
 *   - Scheme must be https.
 *   - Hostname must be present and not a blocked name (localhost, metadata).
 *   - Literal-IP hostnames must not be in a blocked range.
 *   - Username/password userinfo is not allowed (would leak to DNS/logs).
 *   - DNS-resolved IPs (all of them) must not be in a blocked range.
 *
 * DNS failure is treated as a rejection (fail-closed).
 */
export async function assertUrlIsSafe(urlStr: string): Promise<SafeUrlResult> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { ok: false, reason: 'Not a valid URL' };
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return { ok: false, reason: `Scheme ${url.protocol} is not allowed; must be https:` };
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'URL must not contain credentials (userinfo)' };
  }

  const hostname = url.hostname;
  if (!hostname) {
    return { ok: false, reason: 'URL must include a hostname' };
  }

  // Normalize IDN hostnames via URL's own toASCII handling (URL already
  // stores the ASCII/punycode form). Lowercase for suffix checks.
  if (isBlockedHostSync(hostname)) {
    return { ok: false, reason: 'URL targets a private, loopback, or internal host' };
  }

  // If the hostname is a literal IP, we already validated above; skip DNS.
  if (isIP(hostname)) {
    return { ok: true, url };
  }

  // Otherwise, resolve DNS and check every address. Fail closed on error.
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    return { ok: false, reason: 'DNS lookup failed for hostname' };
  }

  if (!addresses || addresses.length === 0) {
    return { ok: false, reason: 'Hostname did not resolve to any IP address' };
  }

  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      return { ok: false, reason: 'Hostname resolves to a private, loopback, or internal IP' };
    }
  }

  return { ok: true, url };
}

/**
 * Per-platform canonical-host allow-list for integrations.
 * Platforms with canonical hosts (like Shopify) must match; platforms with
 * truly arbitrary self-hosted stores (WooCommerce) fall back to the generic
 * private-IP check only.
 *
 * Returns null if the platform has no canonical-host restriction.
 */
export function getPlatformHostPolicy(platform: string): {
  suffixes: string[];
  description: string;
} | null {
  switch (platform) {
    case 'shopify':
      return {
        // .myshopify.com is the canonical admin host; *.shopifypreview.com is
        // for dev/preview and is not used for real store admin, so we do not
        // include it. Operators on custom domains still use the same
        // .myshopify.com admin host for API access.
        suffixes: ['.myshopify.com'],
        description: 'Shopify stores must use a *.myshopify.com admin host',
      };
    case 'dutchie':
      return {
        suffixes: ['.dutchie.com', '.iheartjane.com'],
        description: 'Dutchie stores must use a *.dutchie.com host',
      };
    case 'ftd':
      return {
        suffixes: ['.ftdi.com', '.ftd.com', '.mercurynetwork.com'],
        description: 'FTD integrations must use an FTD Mercury host',
      };
    case 'teleflora':
      return {
        suffixes: ['.teleflora.com', '.myteleflora.com'],
        description: 'Teleflora integrations must use a *.teleflora.com host',
      };
    case 'square':
      return {
        suffixes: ['.squareup.com', '.square.com'],
        description: 'Square integrations must use a *.squareup.com host',
      };
    case 'toast':
      return {
        suffixes: ['.toasttab.com', '.toastwebhooks.com'],
        description: 'Toast integrations must use a *.toasttab.com host',
      };
    case 'pioneerrx':
      return {
        suffixes: ['.pioneerrx.com', '.rxapi.net'],
        description: 'PioneerRx integrations must use a PioneerRx host',
      };
    // WooCommerce, metrc, and anything else: no canonical-host policy.
    default:
      return null;
  }
}

/**
 * Check that the URL's hostname matches the platform's allow-list, if one
 * exists. Returns null on match (or if no policy), or a reason string if
 * the hostname is not permitted.
 */
export function checkPlatformHost(platform: string, urlStr: string): string | null {
  const policy = getPlatformHostPolicy(platform);
  if (!policy) return null;
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return 'Not a valid URL';
  }
  const host = url.hostname.toLowerCase();
  for (const suffix of policy.suffixes) {
    // Allow exact match of the suffix-without-leading-dot OR any subdomain.
    const bare = suffix.startsWith('.') ? suffix.slice(1) : suffix;
    if (host === bare) return null;
    if (host.endsWith(suffix)) return null;
  }
  return policy.description;
}
