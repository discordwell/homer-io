import { z } from 'zod';

export const onboardingStepSchema = z.object({
  key: z.string(),
  label: z.string(),
  completed: z.boolean(),
});
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export const onboardingStatusSchema = z.object({
  completed: z.boolean(),
  currentStep: z.number(),
  steps: z.array(onboardingStepSchema),
});
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;
