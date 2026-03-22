import { z } from 'zod';
import { industrySchema } from './onboarding.js';
import { notificationPrefsSchema } from './notifications.js';

export const brandingSchema = z.object({
  logoUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  companyName: z.string().max(255).optional(),
});
export type Branding = z.infer<typeof brandingSchema>;

export const orgSettingsSchema = z.object({
  timezone: z.string(),
  units: z.enum(['imperial', 'metric']),
  branding: brandingSchema,
  notificationPrefs: notificationPrefsSchema,
});
export type OrgSettings = z.infer<typeof orgSettingsSchema>;

export const updateOrgSettingsSchema = orgSettingsSchema.partial().extend({
  industry: industrySchema.optional(),
  enabledFeatures: z.array(z.string()).optional(),
});
export type UpdateOrgSettingsInput = z.infer<typeof updateOrgSettingsSchema>;
