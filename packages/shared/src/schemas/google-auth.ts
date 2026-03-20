import { z } from 'zod';
import { ROLES } from '../types/roles.js';

export const googleAuthSchema = z.object({
  credential: z.string().min(1),
});
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;

export const orgChoiceSchema = z.object({
  credential: z.string().min(1),
  choice: z.enum(['join', 'fresh', 'demo']),
  orgName: z.string().min(1).max(255).optional(),
});
export type OrgChoiceInput = z.infer<typeof orgChoiceSchema>;

export const orgOptionSchema = z.object({
  type: z.enum(['join', 'fresh', 'demo']),
  tenantId: z.string().uuid().optional(),
  tenantName: z.string().optional(),
});
export type OrgOption = z.infer<typeof orgOptionSchema>;

export const googleAuthResponseSchema = z.object({
  status: z.enum(['existing_user', 'new_user']),
  auth: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string(),
      role: z.enum(ROLES),
      tenantId: z.string().uuid(),
      createdAt: z.string().datetime(),
      avatarUrl: z.string().nullable().optional(),
    }),
  }).optional(),
  orgOptions: z.array(orgOptionSchema).optional(),
  googleEmail: z.string().email().optional(),
  googleName: z.string().optional(),
});
export type GoogleAuthResponse = z.infer<typeof googleAuthResponseSchema>;

export const emailLinkRequestSchema = z.object({
  workEmail: z.string().email(),
});
export type EmailLinkRequest = z.infer<typeof emailLinkRequestSchema>;

export const emailLinkVerifySchema = z.object({
  token: z.string().min(1),
});
export type EmailLinkVerifyInput = z.infer<typeof emailLinkVerifySchema>;
