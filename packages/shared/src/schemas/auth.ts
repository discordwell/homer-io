import { z } from 'zod';
import { ROLES } from '../types/roles.js';

/** Shared password strength rule: 8+ chars, must include uppercase, lowercase, and digit */
export const passwordSchema = z.string().min(8).max(128)
  .refine(
    (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw),
    { message: 'Password must include uppercase, lowercase, and a number' },
  );

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1).max(255),
  orgName: z.string().min(1).max(255),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(ROLES),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(ROLES),
  tenantId: z.string().uuid(),
  createdAt: z.string().datetime(),
  avatarUrl: z.string().nullable().optional(),
  isDemo: z.boolean().optional(),
  industry: z.string().nullable().optional(),
  enabledFeatures: z.array(z.string()).optional(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userResponseSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).min(1),
});
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;

export const demoSessionSchema = z.object({
  email: z.string().email().max(255),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  city: z.string().max(100).optional(),
});
export type DemoSessionInput = z.infer<typeof demoSessionSchema>;
