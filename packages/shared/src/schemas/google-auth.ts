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

/**
 * Email-link verification requires the user to *re-authenticate* before the
 * server will switch their tenant. This closes the account-takeover vector
 * where an attacker emails a crafted link to a victim that silently migrates
 * them into the attacker's tenant on click.
 *
 * The client must supply exactly one of:
 *   - password          → for password-auth users
 *   - googleCredential  → for Google-OAuth-only users (fresh ID token)
 *
 * The link can still be clicked from the link-email inbox (which may be a
 * different browser / device than the logged-in session); the re-auth step
 * forces proof of control over the *original* account.
 */
export const emailLinkVerifySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1).optional(),
  googleCredential: z.string().min(1).optional(),
}).refine(
  (data) => Boolean(data.password) !== Boolean(data.googleCredential),
  { message: 'Provide exactly one of password or googleCredential for re-authentication' },
);
export type EmailLinkVerifyInput = z.infer<typeof emailLinkVerifySchema>;
