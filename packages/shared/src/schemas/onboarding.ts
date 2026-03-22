import { z } from 'zod';

export const INDUSTRIES = ['courier', 'restaurant', 'florist', 'pharmacy', 'cannabis', 'grocery', 'furniture', 'other'] as const;
export const industrySchema = z.enum(INDUSTRIES);
export type Industry = z.infer<typeof industrySchema>;

export const setIndustrySchema = z.object({ industry: industrySchema });
export type SetIndustryInput = z.infer<typeof setIndustrySchema>;

export const onboardingStepSchema = z.object({
  key: z.string(),
  label: z.string(),
  completed: z.boolean(),
  skippable: z.boolean().optional(),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional(),
});
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export const onboardingStatusSchema = z.object({
  completed: z.boolean(),
  currentStep: z.number(),
  steps: z.array(onboardingStepSchema),
});
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;
