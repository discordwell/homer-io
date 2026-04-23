/**
 * Telematics adapter interface.
 *
 * Parallels the POS EcommerceConnector pattern in ../integrations/ but shaped
 * for continuous vehicle-position sync, OAuth-first auth, and HMAC webhooks.
 * Each adapter declares which domains it supports; the registry only calls
 * what the adapter implements.
 */

export type TelematicsProvider = 'samsara' | 'motive' | 'geotab';

export type AuthKind = 'oauth' | 'api_key';

/**
 * Whatever the adapter needs to make an authenticated API call.
 * Stored encrypted (AES-256-GCM) in telematics_connections.auth_material.
 * Concrete shape varies per provider (OAuth uses access/refresh tokens,
 * API-key providers just store the key).
 */
export interface AuthMaterial {
  [key: string]: unknown;
}

/**
 * Describes a credential field the UI should render for API-key-style adapters.
 */
export interface FieldSpec {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  helpText?: string;
}

export interface StartAuthContext {
  tenantId: string;
  redirectUri: string;
  state: string;
}

export type StartAuthResult =
  | { kind: 'oauth'; redirectUrl: string }
  | { kind: 'api_key'; fields: FieldSpec[] };

export interface CompleteAuthOAuthInput {
  code: string;
  redirectUri: string;
}

export interface CompleteAuthApiKeyInput {
  credentials: Record<string, string>;
}

export type CompleteAuthInput = CompleteAuthOAuthInput | CompleteAuthApiKeyInput;

export interface CompleteAuthResult {
  authMaterial: AuthMaterial;
  /** Provider's own org/account identifier — used to detect reconnects. */
  externalOrgId: string | null;
  /** Display name shown in the connection detail panel. */
  accountName: string | null;
  /** Upstream refresh-token expiry, so the poller knows when to proactively refresh. */
  refreshTokenExpiresAt: Date | null;
}

export interface ProbeResult {
  vehicles: boolean;
  drivers: boolean;
  positions: boolean;
}

export interface NormalizedVehicle {
  externalVehicleId: string;
  name: string | null;
  vin: string | null;
  plate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  raw: Record<string, unknown>;
}

export interface NormalizedDriver {
  externalDriverId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  licenseNumber: string | null;
  raw: Record<string, unknown>;
}

export interface NormalizedPosition {
  externalVehicleId: string;
  lat: number;
  lng: number;
  /** mph */
  speed: number | null;
  /** 0-359 */
  heading: number | null;
  recordedAt: Date;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type NormalizedEvent =
  | { kind: 'position'; position: NormalizedPosition }
  | { kind: 'vehicle_upsert'; vehicle: NormalizedVehicle }
  | { kind: 'driver_upsert'; driver: NormalizedDriver };

export interface RegisteredWebhook {
  /** Provider-side webhook identifier (used for deregistration). */
  webhookId: string;
  /** Secret used to verify inbound HMACs. Stored alongside the connection. */
  signingSecret: string;
}

export interface TelematicsAdapter {
  provider: TelematicsProvider;
  displayName: string;
  authKind: AuthKind;
  description: string;

  startAuth(ctx: StartAuthContext): Promise<StartAuthResult> | StartAuthResult;

  completeAuth(ctx: StartAuthContext, input: CompleteAuthInput): Promise<CompleteAuthResult>;

  /**
   * Refresh an about-to-expire access token. Return null when refresh is not
   * possible (e.g. the refresh token itself has expired) — the caller will
   * mark the connection pending_reauth.
   */
  refreshAuth(auth: AuthMaterial): Promise<AuthMaterial | null>;

  probe(auth: AuthMaterial): Promise<ProbeResult>;

  listVehicles?(auth: AuthMaterial, cursor?: string): Promise<Page<NormalizedVehicle>>;
  listDrivers?(auth: AuthMaterial, cursor?: string): Promise<Page<NormalizedDriver>>;
  fetchLatestPositions?(
    auth: AuthMaterial,
    externalVehicleIds?: string[],
  ): Promise<NormalizedPosition[]>;

  registerWebhook?(auth: AuthMaterial, callbackUrl: string): Promise<RegisteredWebhook>;
  deregisterWebhook?(auth: AuthMaterial, webhookId: string): Promise<void>;
  verifyWebhook?(headers: Record<string, string | undefined>, rawBody: string, signingSecret: string): boolean;
  parseWebhook?(rawBody: string): NormalizedEvent[];
}
