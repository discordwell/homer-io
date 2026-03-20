import { create } from 'zustand';
import { api } from '../api/client.js';
import type { OnboardingStatus } from '@homer-io/shared';

interface ProviderStatus {
  sms: { configured: boolean; provider: string };
  email: { configured: boolean; provider: string };
}

interface OnboardingState {
  status: OnboardingStatus | null;
  providerStatus: ProviderStatus | null;
  loading: boolean;
  fetchStatus: () => Promise<void>;
  fetchProviderStatus: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  skipStep: (stepKey: string) => Promise<{ success: boolean; message: string }>;
}

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  status: null,
  providerStatus: null,
  loading: false,
  fetchStatus: async () => {
    set({ loading: true });
    try {
      const status = await api.get<OnboardingStatus>('/onboarding/status');
      set({ status, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  fetchProviderStatus: async () => {
    try {
      const providerStatus = await api.get<ProviderStatus>('/onboarding/provider-status');
      set({ providerStatus });
    } catch {
      // Non-critical — leave as null
    }
  },
  completeOnboarding: async () => {
    await api.post('/onboarding/complete');
    set({ status: { completed: true, currentStep: 5, steps: [] } });
  },
  skipOnboarding: async () => {
    await api.post('/onboarding/skip');
    set({ status: { completed: true, currentStep: 5, steps: [] } });
  },
  skipStep: async (stepKey: string) => {
    const result = await api.post<{ success: boolean; message: string }>('/onboarding/skip-step', { stepKey });
    if (result.success) {
      // Refresh onboarding status to reflect the skipped step
      await get().fetchStatus();
    }
    return result;
  },
}));
