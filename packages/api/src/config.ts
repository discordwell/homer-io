const isProduction = process.env.NODE_ENV === 'production';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val && isProduction) {
    throw new Error(`Missing required env var ${name} in production`);
  }
  return val || '';
}

/**
 * Require an env var regardless of NODE_ENV. Use for secrets that must never
 * fall back to a hardcoded/empty value — e.g. JWT signing keys or encryption
 * keys, where a leaked fallback would allow anyone who reads this repository
 * to forge tokens or decrypt stored credentials.
 */
function requireEnvAlways(name: string, minLength = 0): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `Missing required env var ${name}. This secret must be set in all environments (development, test, and production). See .env.example.`,
    );
  }
  if (minLength > 0 && val.length < minLength) {
    throw new Error(
      `Env var ${name} must be at least ${minLength} characters (got ${val.length}). Generate with: openssl rand -hex 32`,
    );
  }
  return val;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Parse TRUST_PROXY env var into a Fastify-compatible trustProxy value.
 *
 * Fastify's trustProxy accepts: boolean | string | string[] | number | Function.
 * We support:
 * - unset → ['127.0.0.1', '::1'] (loopback-only; correct for same-host reverse proxy like Caddy)
 * - 'false' / 'none' (case-insensitive) → false (trust no proxy, use socket IP)
 * - comma-separated IPs/CIDRs → string[]
 *
 * SECURITY: Do NOT default to `true` — that trusts every proxy hop and lets
 * remote clients spoof X-Forwarded-For / X-Forwarded-Proto (GHSA-444r-cwp2-x5xf),
 * breaking rate limiting, audit logs, and IP allow-lists.
 */
export function parseTrustProxy(raw: string | undefined): false | string[] {
  if (raw === undefined || raw === '') {
    return ['127.0.0.1', '::1'];
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'false' || normalized === 'none') {
    return false;
  }
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) {
    return ['127.0.0.1', '::1'];
  }
  return parts;
}

function splitList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const frontendUrl = trimTrailingSlash(process.env.APP_FRONTEND_URL || 'http://localhost:3001');
const apiUrl = trimTrailingSlash(process.env.APP_API_URL || frontendUrl);
const corsOrigins = splitList(process.env.CORS_ORIGIN);


export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  server: {
    // See parseTrustProxy for semantics. Defaults to loopback-only for safe
    // operation behind a same-host reverse proxy (Caddy → API via 127.0.0.1).
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://homer:homer@localhost:5432/homer',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    // JWT_SECRET is required at startup in every environment. A hardcoded
    // fallback (previously present here) meant any env where NODE_ENV was
    // unset or set to something other than the literal 'production' (e.g.
    // 'staging', 'prod', '') silently used a public secret — allowing
    // anyone who read this repo to forge JWTs for any tenant.
    secret: requireEnvAlways('JWT_SECRET', 32),
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },

  cors: {
    origin: corsOrigins.length > 0
      ? corsOrigins
      : (isProduction ? [frontendUrl] : ['http://localhost:3001']),
  },

  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT) || 9000,
    accessKey: process.env.MINIO_ACCESS_KEY || 'homer',
    secretKey: process.env.MINIO_SECRET_KEY || 'homerdev123',
    bucket: process.env.MINIO_BUCKET || 'homer',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  osrm: {
    url: process.env.OSRM_URL || 'http://localhost:5000',
  },

  google: {
    routesApiKey: process.env.GOOGLE_ROUTES_API_KEY || '',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  maptiler: {
    apiKey: process.env.MAPTILER_API_KEY || '',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  voice: {
    whisperModel: process.env.VOICE_WHISPER_MODEL || 'whisper-1',
    ttsModel: process.env.VOICE_TTS_MODEL || 'tts-1',
    ttsVoice: (process.env.VOICE_TTS_VOICE || 'onyx') as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
  },

  nlops: {
    provider: (['anthropic', 'openai'].includes(process.env.NLOPS_PROVIDER || '') ? process.env.NLOPS_PROVIDER : 'anthropic') as 'anthropic' | 'openai',
    anthropicModel: process.env.NLOPS_ANTHROPIC_MODEL || 'claude-opus-4-6',
    openaiModel: process.env.NLOPS_OPENAI_MODEL || 'gpt-5.4',
    maxLoopIterations: Number(process.env.NLOPS_MAX_ITERATIONS) || 10,
    maxTokens: Number(process.env.NLOPS_MAX_TOKENS) || 4096,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@homer.io',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    prices: {
      standardMonthly: process.env.STRIPE_PRICE_STANDARD_MONTHLY || '',
      standardAnnual: process.env.STRIPE_PRICE_STANDARD_ANNUAL || '',
      growthMonthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY || '',
      growthAnnual: process.env.STRIPE_PRICE_GROWTH_ANNUAL || '',
      scaleMonthly: process.env.STRIPE_PRICE_SCALE_MONTHLY || '',
      scaleAnnual: process.env.STRIPE_PRICE_SCALE_ANNUAL || '',
    },
  },

  integrations: {
    // Required in every environment. Must be high-entropy (≥32 chars).
    // The crypto layer SHA-256-derives a 32-byte AES key from this passphrase.
    encryptionKey: requireEnvAlways('INTEGRATION_ENCRYPTION_KEY', 32),
  },

  telematics: {
    samsara: {
      clientId: process.env.SAMSARA_CLIENT_ID || '',
      clientSecret: process.env.SAMSARA_CLIENT_SECRET || '',
      webhookSigningSecret: process.env.SAMSARA_WEBHOOK_SIGNING_SECRET || '',
    },
    motive: {
      clientId: process.env.MOTIVE_CLIENT_ID || '',
      clientSecret: process.env.MOTIVE_CLIENT_SECRET || '',
      webhookSigningSecret: process.env.MOTIVE_WEBHOOK_SIGNING_SECRET || '',
    },
    geotab: {
      clientId: process.env.GEOTAB_CLIENT_ID || '',
      clientSecret: process.env.GEOTAB_CLIENT_SECRET || '',
      webhookSigningSecret: process.env.GEOTAB_WEBHOOK_SIGNING_SECRET || '',
    },
  },

  app: {
    frontendUrl,
    apiUrl,
  },
} as const;
