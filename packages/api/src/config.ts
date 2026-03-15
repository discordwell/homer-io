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
      starterMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
      starterAnnual: process.env.STRIPE_PRICE_STARTER_ANNUAL || '',
      growthMonthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY || '',
      growthAnnual: process.env.STRIPE_PRICE_GROWTH_ANNUAL || '',
      enterpriseMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
      enterpriseAnnual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || '',
    },
  },

  integrations: {
    encryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY || '',
  },

  app: {
    frontendUrl: process.env.APP_FRONTEND_URL || 'http://localhost:3001',
  },
} as const;
