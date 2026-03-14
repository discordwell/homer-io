import { z } from 'zod';

export const aiChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type AiChatMessage = z.infer<typeof aiChatMessageSchema>;

export const aiChatRequestSchema = z.object({
  message: z.string().min(1).max(5000),
  history: z.array(aiChatMessageSchema).max(50).default([]),
});
export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

export const aiChatResponseSchema = z.object({
  reply: z.string(),
});
export type AiChatResponse = z.infer<typeof aiChatResponseSchema>;
