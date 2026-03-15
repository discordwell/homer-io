import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { db } from '../../lib/db/index.js';
import { config } from '../../config.js';

// Singleton Redis client for health checks
let healthRedis: Redis | null = null;
function getHealthRedis(): Redis {
  if (!healthRedis) {
    healthRedis = new Redis(config.redis.url, { maxRetriesPerRequest: 1, lazyConnect: true });
    healthRedis.on('error', () => { /* suppress connection errors */ });
  }
  return healthRedis;
}

function categorize(ms: number): 'healthy' | 'degraded' | 'down' {
  if (ms < 100) return 'healthy';
  if (ms < 500) return 'degraded';
  return 'down';
}

export async function getHealthStatus() {
  // DB latency
  let dbLatency = -1;
  let dbStatus: 'healthy' | 'degraded' | 'down' = 'down';
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatency = Date.now() - start;
    dbStatus = categorize(dbLatency);
  } catch { /* down */ }

  // Redis latency
  let redisLatency = -1;
  let redisStatus: 'healthy' | 'degraded' | 'down' = 'down';
  try {
    const redis = getHealthRedis();
    const start = Date.now();
    await redis.ping();
    redisLatency = Date.now() - start;
    redisStatus = categorize(redisLatency);

    // Queue depths
    const queueNames = [
      'route-optimization', 'notifications', 'analytics',
      'customer-notifications', 'webhook-delivery', 'billing-usage',
      'integration-sync', 'report-generation', 'route-template',
      'data-export', 'data-retention',
    ];
    const queueDepths: Record<string, number> = {};
    for (const name of queueNames) {
      const depth = await redis.llen(`bull:${name}:wait`);
      queueDepths[name] = depth;
    }

    const mem = process.memoryUsage();
    return {
      status: dbStatus === 'healthy' && redisStatus === 'healthy' ? 'healthy' : 'degraded',
      database: { latencyMs: dbLatency, status: dbStatus },
      redis: { latencyMs: redisLatency, status: redisStatus },
      queues: queueDepths,
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
      version: '0.5.0',
      timestamp: new Date().toISOString(),
    };
  } catch {
    const mem = process.memoryUsage();
    return {
      status: 'degraded',
      database: { latencyMs: dbLatency, status: dbStatus },
      redis: { latencyMs: redisLatency, status: redisStatus },
      queues: {},
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
      version: '0.5.0',
      timestamp: new Date().toISOString(),
    };
  }
}
