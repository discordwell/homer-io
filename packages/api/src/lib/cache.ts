import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from './logger.js';

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
    logger.error({ err, key }, '[cache] GET error');
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    await getRedis().set(`${KEY_PREFIX}${key}`, raw, 'EX', ttlSeconds);
  } catch (err) {
    logger.error({ err, key }, '[cache] SET error');
  }
}

/**
 * Atomic "set-if-not-exists" with TTL. Returns true if the key was newly
 * claimed (i.e. did not exist), false if another caller already holds it.
 *
 * On Redis errors we fail OPEN (return true) so transient Redis issues don't
 * block critical paths — callers that need strict dedup should layer a DB
 * uniqueness constraint on top of this.
 *
 * Use for idempotency / dedup primitives (e.g. Stripe webhook event IDs,
 * confirmation-token replay protection) where a check-then-set is racy.
 */
export async function cacheSetNX(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<boolean> {
  try {
    const raw = JSON.stringify(value);
    const result = await getRedis().set(`${KEY_PREFIX}${key}`, raw, 'EX', ttlSeconds, 'NX');
    // ioredis returns 'OK' on successful NX set, null if the key already existed
    return result === 'OK';
  } catch (err) {
    console.error(`[cache] SETNX error for key "${key}":`, err);
    // Fail open: do not block callers on transient Redis errors.
    return true;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await getRedis().del(`${KEY_PREFIX}${key}`);
  } catch (err) {
    logger.error({ err, key }, '[cache] DEL error');
  }
}

/** Atomic increment. Returns the new value. Sets TTL on first creation. */
export async function cacheIncr(key: string, ttlSeconds: number): Promise<number> {
  try {
    const r = getRedis();
    const fullKey = `${KEY_PREFIX}${key}`;
    const val = await r.incr(fullKey);
    if (val === 1) {
      // First increment — set TTL
      await r.expire(fullKey, ttlSeconds);
    }
    return val;
  } catch (err) {
    logger.error({ err, key }, '[cache] INCR error');
    return 0;
  }
}

/** Atomic decrement. Returns the new value. Deletes key if result <= 0. */
export async function cacheDecr(key: string): Promise<number> {
  try {
    const r = getRedis();
    const fullKey = `${KEY_PREFIX}${key}`;
    const val = await r.decr(fullKey);
    if (val <= 0) {
      await r.del(fullKey);
      return 0;
    }
    return val;
  } catch (err) {
    logger.error({ err, key }, '[cache] DECR error');
    return 0;
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
    logger.error({ err, pattern }, '[cache] DEL pattern error');
  }
}
