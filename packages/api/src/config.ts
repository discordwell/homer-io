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
} as const;
