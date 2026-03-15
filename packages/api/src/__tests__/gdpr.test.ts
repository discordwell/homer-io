import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dataExportRequestSchema, dataDeletionRequestSchema, dataDeletionConfirmSchema } from '@homer-io/shared';

// Mock db
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const returning = vi.fn();
const where = vi.fn();
const from = vi.fn();
const limit = vi.fn();
const orderBy = vi.fn();
const set = vi.fn();
const values = vi.fn();

vi.mock('../lib/db/index.js', () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return { values: (...a: unknown[]) => { values(...a); return { returning: () => returning() }; } };
    },
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...a: unknown[]) => {
          from(...a);
          return {
            where: (...w: unknown[]) => {
              where(...w);
              return {
                limit: () => limit(),
                orderBy: () => orderBy(),
              };
            },
            orderBy: () => orderBy(),
          };
        },
      };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return { set: (...a: unknown[]) => { set(...a); return { where: () => where() }; } };
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args);
      return { where: (...w: unknown[]) => { where(...w); return { returning: () => returning() }; } };
    },
  },
}));

vi.mock('../lib/db/schema/data-requests.js', () => ({
  dataExportRequests: { id: 'id', tenantId: 'tenant_id', status: 'status', createdAt: 'created_at' },
  dataDeletionRequests: { id: 'id', tenantId: 'tenant_id', status: 'status', confirmationToken: 'confirmation_token', createdAt: 'created_at' },
}));

vi.mock('../lib/db/schema/users.js', () => ({
  users: { id: 'id', email: 'email' },
}));

vi.mock('../lib/errors.js', () => ({
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  NotFoundError: class NotFoundError extends Error {
    statusCode = 404;
    constructor(message = 'Not found') {
      super(message);
    }
  },
}));

vi.mock('../config.js', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' },
    app: { frontendUrl: 'http://localhost:3001' },
    sendgrid: { apiKey: '' },
  },
}));

vi.mock('../lib/email.js', () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('bullmq', () => ({
  Queue: class MockQueue {
    add = vi.fn().mockResolvedValue({});
  },
}));

describe('GDPR schemas', () => {
  it('validates data export request schema', () => {
    const result = dataExportRequestSchema.parse({});
    expect(result.format).toBe('json');
  });

  it('validates data export with explicit format', () => {
    const result = dataExportRequestSchema.parse({ format: 'json' });
    expect(result.format).toBe('json');
  });

  it('validates data deletion request schema', () => {
    const result = dataDeletionRequestSchema.parse({ confirmPhrase: 'DELETE MY ACCOUNT' });
    expect(result.confirmPhrase).toBe('DELETE MY ACCOUNT');
  });

  it('rejects empty confirm phrase', () => {
    expect(() => dataDeletionRequestSchema.parse({ confirmPhrase: '' })).toThrow();
  });

  it('validates data deletion confirm schema', () => {
    const result = dataDeletionConfirmSchema.parse({ token: 'abc123' });
    expect(result.token).toBe('abc123');
  });

  it('rejects empty token', () => {
    expect(() => dataDeletionConfirmSchema.parse({ token: '' })).toThrow();
  });
});

describe('GDPR service - export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requestDataExport inserts a record and enqueues a job', async () => {
    const mockExport = { id: 'exp-1', tenantId: 't-1', requestedBy: 'u-1', status: 'queued' };
    returning.mockResolvedValueOnce([mockExport]);

    const { requestDataExport } = await import('../modules/gdpr/service.js');
    const result = await requestDataExport('t-1', 'u-1');

    expect(result.id).toBe('exp-1');
    expect(result.status).toBe('queued');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('listExportRequests returns records for tenant', async () => {
    const mockExports = [
      { id: 'exp-1', status: 'completed' },
      { id: 'exp-2', status: 'queued' },
    ];
    orderBy.mockResolvedValueOnce(mockExports);

    const { listExportRequests } = await import('../modules/gdpr/service.js');
    const result = await listExportRequests('t-1');

    expect(result).toEqual(mockExports);
  });
});

describe('GDPR service - deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requestAccountDeletion rejects incorrect confirm phrase', async () => {
    const { requestAccountDeletion } = await import('../modules/gdpr/service.js');
    await expect(requestAccountDeletion('t-1', 'u-1', 'wrong'))
      .rejects.toThrow('Please type "DELETE MY ACCOUNT" to confirm');
  });

  it('requestAccountDeletion rejects when pending request exists', async () => {
    limit.mockResolvedValueOnce([{ id: 'del-1', status: 'pending' }]);

    const { requestAccountDeletion } = await import('../modules/gdpr/service.js');
    await expect(requestAccountDeletion('t-1', 'u-1', 'DELETE MY ACCOUNT'))
      .rejects.toThrow('A deletion request is already pending');
  });

  it('cancelDeletion throws when no active request found', async () => {
    returning.mockResolvedValueOnce([]);
    returning.mockResolvedValueOnce([]);

    const { cancelDeletion } = await import('../modules/gdpr/service.js');
    await expect(cancelDeletion('t-1'))
      .rejects.toThrow('No active deletion request found');
  });

  it('cancelDeletion succeeds when pending request exists', async () => {
    returning.mockResolvedValueOnce([{ id: 'del-1' }]);

    const { cancelDeletion } = await import('../modules/gdpr/service.js');
    const result = await cancelDeletion('t-1');
    expect(result.success).toBe(true);
  });
});
