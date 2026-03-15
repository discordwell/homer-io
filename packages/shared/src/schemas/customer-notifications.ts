import { z } from 'zod';

export const notificationTriggers = [
  'order_assigned', 'driver_en_route', 'delivery_approaching', 'delivered', 'failed',
] as const;
export type NotificationTrigger = (typeof notificationTriggers)[number];

export const notificationChannels = ['sms', 'email'] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

export const createNotificationTemplateSchema = z.object({
  trigger: z.enum(notificationTriggers),
  channel: z.enum(notificationChannels),
  subject: z.string().max(255).optional(),
  bodyTemplate: z.string().min(1).max(2000),
  isActive: z.boolean().default(true),
});
export type CreateNotificationTemplateInput = z.infer<typeof createNotificationTemplateSchema>;

export const updateNotificationTemplateSchema = createNotificationTemplateSchema.partial();
export type UpdateNotificationTemplateInput = z.infer<typeof updateNotificationTemplateSchema>;

export const customerNotificationLogSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  channel: z.string(),
  trigger: z.string(),
  recipient: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  status: z.enum(['queued', 'sent', 'delivered', 'failed']),
  providerId: z.string().nullable(),
  errorMessage: z.string().nullable(),
  sentAt: z.string().nullable(),
  createdAt: z.string(),
});
export type CustomerNotificationLog = z.infer<typeof customerNotificationLogSchema>;
