const isProduction = process.env.NODE_ENV === 'production';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val && isProduction) {
    throw new Error(`Missing required env var ${name} in production`);
  }
  return val || '';
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://homer:homer@localhost:5432/homer',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: isProduction ? requireEnv('JWT_SECRET') : (process.env.JWT_SECRET || 'homer-dev-secret-do-not-use-in-prod'),
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || (isProduction
      ? ['https://app.homer.io', 'https://homer.discordwell.com']
      : ['http://localhost:3001']
    ),
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
    encryptionKey: isProduction ? requireEnv('INTEGRATION_ENCRYPTION_KEY') : (process.env.INTEGRATION_ENCRYPTION_KEY || ''),
  },

  app: {
    frontendUrl: process.env.APP_FRONTEND_URL || 'http://localhost:3001',
  },
} as const;
