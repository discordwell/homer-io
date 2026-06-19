import { describe, it, expect, vi } from 'vitest';
import { meteredQuotas, meteredRates } from '@homer-io/shared';

// Importing the billing service pulls in config (env validation) + db (opens a
// postgres client). Stub them so the pure helper can be imported in isolation.
vi.mock('../config.js', () => ({
  config: { stripe: { secretKey: '', prices: {} }, database: { url: '' }, redis: { url: '' } },
}));
vi.mock('../lib/db/index.js', () => ({ db: {} }));
vi.mock('../lib/cache.js', () => ({ cacheDelete: vi.fn(), cacheGet: vi.fn(), cacheSet: vi.fn() }));
vi.mock('../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../lib/activity.js', () => ({ logActivity: vi.fn() }));

const { computeOverageCosts } = await import('../modules/billing/service.js');

function zeroUsage() {
  return {
    aiOptimizations: 0,
    aiDispatches: 0,
    aiChatMessages: 0,
    smsSent: 0,
    emailsSent: 0,
    podStorageMb: 0,
  };
}

describe('computeOverageCosts', () => {
  it('charges nothing when every feature is within quota', () => {
    const costs = computeOverageCosts(zeroUsage());
    for (const cents of Object.values(costs)) expect(cents).toBe(0);
  });

  it('prices podStorageMb overage per GB, not per MB (no 1024x overcharge)', () => {
    // 3072 MB used − 1024 MB quota = 2048 MB = 2 GB overage at 10¢/GB = 20¢.
    const costs = computeOverageCosts({ ...zeroUsage(), podStorageMb: 3072 });
    expect(costs.podStorageMb).toBe(20);
    // The old MB×(¢/GB) math produced 2048 × 10 = 20480¢ ($204.80).
    expect(costs.podStorageMb).not.toBe(20480);
  });

  it('prices a fractional GB of storage overage correctly', () => {
    // 1536 MB − 1024 MB = 512 MB = 0.5 GB at 10¢/GB = 5¢.
    const costs = computeOverageCosts({ ...zeroUsage(), podStorageMb: 1536 });
    expect(costs.podStorageMb).toBeCloseTo(5, 10);
  });

  it('prices per-count features with their integer rate', () => {
    // aiOptimizations: quota 10, rate 5¢. 13 used → 3 over → 15¢.
    const costs = computeOverageCosts({ ...zeroUsage(), aiOptimizations: 13 });
    expect(costs.aiOptimizations).toBe(3 * meteredRates.aiOptimizations);
    expect(costs.aiOptimizations).toBe(15);
  });

  it('treats exactly-at-quota usage as zero overage', () => {
    const costs = computeOverageCosts({ ...zeroUsage(), smsSent: meteredQuotas.smsSent });
    expect(costs.smsSent).toBe(0);
  });
});
