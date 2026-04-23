/**
 * Samsara telematics adapter.
 *
 * OAuth 2.0 (authorization_code + refresh_token), single-use refresh tokens,
 * 1-hour access token TTL. Webhooks are configured at the Samsara marketplace-
 * app level (one URL + one signing secret shared across all connected tenants)
 * — Samsara routes each event with the org identifier in the payload, so
 * `registerWebhook` is a no-op; verification uses a deploy-level secret pulled
 * from env.
 *
 * Refs:
 *  - https://developers.samsara.com/docs/oauth-20
 *  - https://developers.samsara.com/reference/listvehicles
 *  - https://developers.samsara.com/reference/getvehiclelocations
 *  - https://developers.samsara.com/docs/webhooks
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../../config.js';
import { logger } from '../logger.js';
import type {
  TelematicsAdapter,
  AuthMaterial,
  StartAuthContext,
  StartAuthResult,
  CompleteAuthInput,
  CompleteAuthResult,
  ProbeResult,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedEvent,
  Page,
} from './adapter.js';

const SAMSARA_BASE = 'https://api.samsara.com';

interface SamsaraAuth extends AuthMaterial {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

interface SamsaraTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

function basicAuthHeader(): string {
  const clientId = config.telematics?.samsara?.clientId;
  const clientSecret = config.telematics?.samsara?.clientSecret;
  if (!clientId || !clientSecret) {
    throw new Error('SAMSARA_CLIENT_ID / SAMSARA_CLIENT_SECRET missing');
  }
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

async function tokenRequest(params: Record<string, string>): Promise<SamsaraTokenResponse> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`${SAMSARA_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Samsara token exchange failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<SamsaraTokenResponse>;
}

function materializeAuth(tok: SamsaraTokenResponse): SamsaraAuth {
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: Date.now() + tok.expires_in * 1000,
  };
}

async function authedGet(path: string, auth: SamsaraAuth, query?: Record<string, string | undefined>): Promise<Response> {
  const url = new URL(`${SAMSARA_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  return fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}`, Accept: 'application/json' },
  });
}

interface SamsaraVehicleRaw {
  id: string;
  name?: string;
  vin?: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  year?: number | string;
  [key: string]: unknown;
}

interface SamsaraListResponse<T> {
  data: T[];
  pagination?: { endCursor?: string | null; hasNextPage?: boolean };
}

interface SamsaraLocationRaw {
  id: string;
  name?: string;
  location?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number; // mph
    time?: string;
  };
}

export const samsaraAdapter: TelematicsAdapter = {
  provider: 'samsara',
  displayName: 'Samsara',
  description: 'Connect your Samsara fleet to stream vehicle positions into Homer.',
  authKind: 'oauth',

  startAuth(ctx: StartAuthContext): StartAuthResult {
    const clientId = config.telematics?.samsara?.clientId;
    if (!clientId) throw new Error('SAMSARA_CLIENT_ID missing');
    const url = new URL(`${SAMSARA_BASE}/oauth2/authorize`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', ctx.state);
    url.searchParams.set('redirect_uri', ctx.redirectUri);
    return { kind: 'oauth', redirectUrl: url.toString() };
  },

  async completeAuth(_ctx, input: CompleteAuthInput): Promise<CompleteAuthResult> {
    if (!('code' in input)) throw new Error('Samsara requires OAuth code');
    const tok = await tokenRequest({
      grant_type: 'authorization_code',
      code: input.code,
    });
    const auth = materializeAuth(tok);
    // Fetch org info to get a display name; best-effort.
    let accountName: string | null = null;
    let externalOrgId: string | null = null;
    try {
      const res = await authedGet('/me', auth);
      if (res.ok) {
        const body = await res.json() as { data?: { organizationName?: string; organizationId?: string } };
        accountName = body.data?.organizationName ?? null;
        externalOrgId = body.data?.organizationId ?? null;
      }
    } catch (err) {
      logger.warn({ err }, 'samsara /me fetch failed; continuing without account metadata');
    }
    return {
      authMaterial: auth,
      externalOrgId,
      accountName,
      refreshTokenExpiresAt: null, // Samsara refresh tokens don't carry an explicit expiry
    };
  },

  async refreshAuth(auth: AuthMaterial): Promise<AuthMaterial | null> {
    const a = auth as SamsaraAuth;
    try {
      const tok = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: a.refreshToken,
      });
      return materializeAuth(tok);
    } catch (err) {
      logger.warn({ err }, 'samsara refresh failed; connection will be marked pending_reauth');
      return null;
    }
  },

  async probe(auth: AuthMaterial): Promise<ProbeResult> {
    const a = auth as SamsaraAuth;
    const res = await authedGet('/fleet/vehicles', a, { limit: '1' });
    const canRead = res.ok;
    return { vehicles: canRead, drivers: canRead, positions: canRead };
  },

  async listVehicles(auth: AuthMaterial, cursor?: string): Promise<Page<NormalizedVehicle>> {
    const a = auth as SamsaraAuth;
    const res = await authedGet('/fleet/vehicles', a, { limit: '100', after: cursor });
    if (!res.ok) {
      throw new Error(`samsara listVehicles failed: ${res.status}`);
    }
    const body = await res.json() as SamsaraListResponse<SamsaraVehicleRaw>;
    const items: NormalizedVehicle[] = (body.data || []).map(v => ({
      externalVehicleId: v.id,
      name: v.name ?? null,
      vin: v.vin ?? null,
      plate: v.licensePlate ?? null,
      make: v.make ?? null,
      model: v.model ?? null,
      year: typeof v.year === 'number' ? v.year : typeof v.year === 'string' ? Number.parseInt(v.year, 10) || null : null,
      raw: v as Record<string, unknown>,
    }));
    return {
      items,
      nextCursor: body.pagination?.hasNextPage ? (body.pagination.endCursor ?? null) : null,
    };
  },

  async fetchLatestPositions(auth: AuthMaterial, externalVehicleIds?: string[]): Promise<NormalizedPosition[]> {
    const a = auth as SamsaraAuth;
    const query: Record<string, string | undefined> = {};
    if (externalVehicleIds?.length) query.vehicleIds = externalVehicleIds.join(',');
    const res = await authedGet('/fleet/vehicles/locations', a, query);
    if (!res.ok) {
      throw new Error(`samsara fetchLatestPositions failed: ${res.status}`);
    }
    const body = await res.json() as { data?: SamsaraLocationRaw[] };
    const out: NormalizedPosition[] = [];
    for (const v of body.data || []) {
      if (!v.location) continue;
      out.push({
        externalVehicleId: v.id,
        lat: v.location.latitude,
        lng: v.location.longitude,
        speed: v.location.speed ?? null,
        heading: typeof v.location.heading === 'number' ? Math.round(v.location.heading) : null,
        recordedAt: v.location.time ? new Date(v.location.time) : new Date(),
      });
    }
    return out;
  },

  // Samsara marketplace apps register webhooks at the app level, not per
  // connection. Homer admin sets SAMSARA_WEBHOOK_SIGNING_SECRET once; every
  // connection uses it. registerWebhook is a no-op that returns the shared
  // secret so the service layer's storage path is uniform across adapters.
  async registerWebhook(_auth: AuthMaterial, _callbackUrl: string) {
    const secret = config.telematics?.samsara?.webhookSigningSecret;
    if (!secret) {
      throw new Error('SAMSARA_WEBHOOK_SIGNING_SECRET not configured');
    }
    return { webhookId: 'samsara-app-level', signingSecret: secret };
  },

  verifyWebhook(headers, rawBody, signingSecret): boolean {
    const timestamp = headers['x-samsara-timestamp'];
    const sig = headers['x-samsara-signature'];
    if (typeof timestamp !== 'string' || typeof sig !== 'string') return false;
    if (!sig.startsWith('v1=')) return false;

    // Replay-attack defence: reject anything more than 5 minutes off from
    // server clock. Samsara sends seconds-since-epoch. Without this, an
    // attacker who captures one signed payload (leaked logs, compromised
    // middlebox, shared-secret exposure) can replay it indefinitely — and
    // because the signing secret is shared app-wide, cross-tenant.
    const tsMs = Number.parseInt(timestamp, 10) * 1000;
    if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60_000) {
      return false;
    }

    const providedHex = sig.slice(3);
    // Samsara secret is base64-encoded; decode before HMAC.
    const key = Buffer.from(signingSecret, 'base64');
    const msg = `v1:${timestamp}:${rawBody}`;
    const expected = createHmac('sha256', key).update(msg).digest('hex');
    const a = Buffer.from(providedHex, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },

  parseWebhook(rawBody: string): NormalizedEvent[] {
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return [];
    }
    if (!body || typeof body !== 'object') return [];
    const payload = body as {
      eventType?: string;
      data?: {
        vehicle?: { id?: string };
        location?: { latitude?: number; longitude?: number; speed?: number; heading?: number; time?: string };
      };
    };
    const out: NormalizedEvent[] = [];
    if (
      payload.eventType === 'VehicleLocationUpdate' &&
      payload.data?.vehicle?.id &&
      typeof payload.data.location?.latitude === 'number' &&
      typeof payload.data.location?.longitude === 'number'
    ) {
      out.push({
        kind: 'position',
        position: {
          externalVehicleId: payload.data.vehicle.id,
          lat: payload.data.location.latitude,
          lng: payload.data.location.longitude,
          speed: payload.data.location.speed ?? null,
          heading: typeof payload.data.location.heading === 'number' ? Math.round(payload.data.location.heading) : null,
          recordedAt: payload.data.location.time ? new Date(payload.data.location.time) : new Date(),
        },
      });
    }
    return out;
  },
};
