import { z } from 'zod';

export const registerDeviceSchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(['ios', 'android']),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
