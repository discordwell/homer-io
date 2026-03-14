import { z } from 'zod';

export const notificationTypeEnum = z.enum([
  'delivery_completed', 'delivery_failed', 'route_started', 'route_completed',
  'driver_offline', 'system', 'team_invite', 'order_received',
]);
export type NotificationType = z.infer<typeof notificationTypeEnum>;

export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: notificationTypeEnum,
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).default({}),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationPrefsSchema = z.object({
  deliveryUpdates: z.boolean().default(true),
  routeUpdates: z.boolean().default(true),
  driverAlerts: z.boolean().default(true),
  systemNotices: z.boolean().default(true),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
