import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

vi.mock('../config.js', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' },
  },
}));

vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      ping = vi.fn().mockResolvedValue('PONG');
      llen = vi.fn().mockResolvedValue(0);
      quit = vi.fn().mockResolvedValue('OK');
    },
  };
});

describe('Health service', () => {
  it('returns health status with expected fields', async () => {
    const { getHealthStatus } = await import('../modules/health/service.js');
    const status = await getHealthStatus();

    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('database');
    expect(status).toHaveProperty('redis');
    expect(status).toHaveProperty('queues');
    expect(status).toHaveProperty('memory');
    expect(status).toHaveProperty('uptime');
    expect(status).toHaveProperty('version');
    expect(status).toHaveProperty('timestamp');
  });

  it('returns database health info', async () => {
    const { getHealthStatus } = await import('../modules/health/service.js');
    const status = await getHealthStatus();

    expect(status.database).toHaveProperty('latencyMs');
    expect(status.database).toHaveProperty('status');
    expect(typeof status.database.latencyMs).toBe('number');
  });

  it('returns redis health info', async () => {
    const { getHealthStatus } = await import('../modules/health/service.js');
    const status = await getHealthStatus();

    expect(status.redis).toHaveProperty('latencyMs');
    expect(status.redis).toHaveProperty('status');
  });

  it('returns memory stats in MB', async () => {
    const { getHealthStatus } = await import('../modules/health/service.js');
    const status = await getHealthStatus();

    expect(status.memory).toHaveProperty('rss');
    expect(status.memory).toHaveProperty('heapUsed');
    expect(status.memory).toHaveProperty('heapTotal');
    expect(typeof status.memory.rss).toBe('number');
    expect(status.memory.rss).toBeGreaterThan(0);
  });

  it('returns queue depths for all queues', async () => {
    const { getHealthStatus } = await import('../modules/health/service.js');
    const status = await getHealthStatus();

    expect(status.queues).toHaveProperty('route-optimization');
    expect(status.queues).toHaveProperty('data-export');
    expect(status.queues).toHaveProperty('data-retention');
  });

  it('returns version string', async () => {
    const { getHealthStatus } = await import('../modules/health/service.js');
    const status = await getHealthStatus();

    expect(status.version).toBe('0.5.0');
  });

  it('returns valid ISO timestamp', async () => {
    const { getHealthStatus } = await import('../modules/health/service.js');
    const status = await getHealthStatus();

    expect(new Date(status.timestamp).toISOString()).toBe(status.timestamp);
  });

  it('returns uptime as a positive number', async () => {
    const { getHealthStatus } = await import('../modules/health/service.js');
    const status = await getHealthStatus();

    expect(typeof status.uptime).toBe('number');
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });
});
