import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateNotificationTemplateInput } from '@homer-io/shared';

// The service constructs a BullMQ Queue at import time; stub it so no Redis
// connection is attempted.
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({ add: vi.fn(), on: vi.fn() })),
  Worker: vi.fn(),
}));
vi.mock('../config.js', () => ({
  config: { redis: { url: 'redis://localhost:6379' }, app: { frontendUrl: 'https://homer.test' } },
}));
vi.mock('../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../lib/activity.js', () => ({ logActivity: vi.fn() }));

// Capture the row handed to db.insert(...).values(...) so we can assert exactly
// what createTemplate persists.
const captured: { values?: Record<string, unknown> } = {};
vi.mock('../lib/db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        captured.values = v;
        return { returning: vi.fn(() => Promise.resolve([{ id: 'tmpl-1', ...v }])) };
      }),
    })),
  },
}));

const { createTemplate } = await import('../modules/customer-notifications/service.js');

function input(overrides: Partial<CreateNotificationTemplateInput> = {}): CreateNotificationTemplateInput {
  return {
    trigger: 'delivered',
    channel: 'email',
    bodyTemplate: 'Hi {{senderName}}, the flowers for {{recipientName}} were delivered.',
    isActive: true,
    recipientType: 'recipient',
    ...overrides,
  };
}

describe('createTemplate persists recipientType', () => {
  beforeEach(() => { captured.values = undefined; });

  it('writes recipientType "sender" (gift-sender notifications)', async () => {
    await createTemplate('tenant-1', input({ recipientType: 'sender' }));
    expect(captured.values?.recipientType).toBe('sender');
  });

  it('writes recipientType "both"', async () => {
    await createTemplate('tenant-1', input({ channel: 'sms', recipientType: 'both' }));
    expect(captured.values?.recipientType).toBe('both');
  });

  it('writes recipientType "recipient" for the default case', async () => {
    await createTemplate('tenant-1', input({ recipientType: 'recipient' }));
    expect(captured.values?.recipientType).toBe('recipient');
  });

  it('falls back to "recipient" when recipientType is absent', async () => {
    const partial = { trigger: 'delivered', channel: 'sms', bodyTemplate: 'Delivered!', isActive: true } as unknown as CreateNotificationTemplateInput;
    await createTemplate('tenant-1', partial);
    expect(captured.values?.recipientType).toBe('recipient');
  });
});
