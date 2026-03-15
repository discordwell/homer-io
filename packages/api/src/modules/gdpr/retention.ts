export const RETENTION_POLICIES = {
  location_history: { days: 90, table: 'location_history' },
  activity_log: { days: 365, table: 'activity_log' },
  customer_notifications_log: { days: 180, table: 'customer_notifications_log' },
  webhook_deliveries: { days: 90, table: 'webhook_deliveries' },
} as const;
