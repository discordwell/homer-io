import { z } from 'zod';

export const integrationPlatformEnum = z.enum(['shopify', 'woocommerce']);
export type IntegrationPlatform = z.infer<typeof integrationPlatformEnum>;

export const createConnectionSchema = z.object({
  platform: integrationPlatformEnum,
  storeUrl: z.string().url(),
  credentials: z.record(z.string(), z.string()),
  autoImport: z.boolean().default(true),
});
export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

export const updateConnectionSchema = z.object({
  credentials: z.record(z.string(), z.string()).optional(),
  autoImport: z.boolean().optional(),
});
export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>;

export const connectionResponseSchema = z.object({
  id: z.string(),
  platform: integrationPlatformEnum,
  storeUrl: z.string(),
  autoImport: z.boolean(),
  syncStatus: z.enum(['idle', 'syncing', 'error']),
  lastSyncAt: z.string().nullable(),
  lastSyncError: z.string().nullable(),
  orderCount: z.number(),
  createdAt: z.string(),
});
export type ConnectionResponse = z.infer<typeof connectionResponseSchema>;

export const integrationOrderResponseSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  orderId: z.string().nullable(),
  externalOrderId: z.string(),
  platform: z.string(),
  syncStatus: z.enum(['pending', 'synced', 'failed', 'skipped']),
  syncError: z.string().nullable(),
  createdAt: z.string(),
});
export type IntegrationOrderResponse = z.infer<typeof integrationOrderResponseSchema>;

export const platformInfoSchema = z.object({
  platform: integrationPlatformEnum,
  name: z.string(),
  description: z.string(),
  requiredCredentials: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'password']),
    placeholder: z.string().optional(),
  })),
});
export type PlatformInfo = z.infer<typeof platformInfoSchema>;
