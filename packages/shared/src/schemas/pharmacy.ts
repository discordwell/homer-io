import { z } from 'zod';

// ---------------------------------------------------------------------------
// Pharmacy tenant settings
// ---------------------------------------------------------------------------

export const controlledScheduleEnum = z.enum(['II', 'III', 'IV', 'V']);
export type ControlledSchedule = z.infer<typeof controlledScheduleEnum>;

export const pharmacySettingsSchema = z.object({
  licenseNumber: z.string().min(1).max(100),
  npi: z.string().max(20).default(''),
  state: z.string().length(2),
  requireSignature: z.boolean().default(true),
  requireDobVerification: z.boolean().default(true),
  requirePhoto: z.boolean().default(true),
  hipaaSafeDriverDisplay: z.boolean().default(true),
  defaultControlledSubstanceBehavior: z.enum(['signature_required', 'id_required']).default('signature_required'),
  coldChainAlerts: z.boolean().default(true),
});
export type PharmacySettings = z.infer<typeof pharmacySettingsSchema>;

export const updatePharmacySettingsSchema = pharmacySettingsSchema.partial();
export type UpdatePharmacySettingsInput = z.infer<typeof updatePharmacySettingsSchema>;
