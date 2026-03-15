import Redis from 'ioredis';
import { config } from '../config.js';

const KEY_PREFIX = 'homer:';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url);
  }
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedis().get(`${KEY_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[cache] GET error for key "${key}":`, err);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    await getRedis().set(`${KEY_PREFIX}${key}`, raw, 'EX', ttlSeconds);
  } catch (err) {
    console.error(`[cache] SET error for key "${key}":`, err);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await getRedis().del(`${KEY_PREFIX}${key}`);
  } catch (err) {
    console.error(`[cache] DEL error for key "${key}":`, err);
  }
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  try {
    const r = getRedis();
    const fullPattern = `${KEY_PREFIX}${pattern}`;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await r.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await r.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error(`[cache] DEL pattern error for "${pattern}":`, err);
  }
}
