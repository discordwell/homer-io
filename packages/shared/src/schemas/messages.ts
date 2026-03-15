import { z } from 'zod';

export const sendMessageSchema = z.object({
  routeId: z.string().uuid().optional(),
  recipientId: z.string().uuid().optional(),
  body: z.string().min(1).max(2000),
  attachmentUrl: z.string().url().optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const messageResponseSchema = z.object({
  id: z.string().uuid(),
  routeId: z.string().uuid().nullable(),
  senderId: z.string().uuid(),
  senderName: z.string().optional(),
  recipientId: z.string().uuid().nullable(),
  body: z.string(),
  attachmentUrl: z.string().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type MessageResponse = z.infer<typeof messageResponseSchema>;

export const messageListQuerySchema = z.object({
  routeId: z.string().uuid().optional(),
  recipientId: z.string().uuid().optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MessageListQuery = z.infer<typeof messageListQuerySchema>;
