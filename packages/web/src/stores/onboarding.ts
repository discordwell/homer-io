import { create } from 'zustand';
import { api } from '../api/client.js';
import type { OnboardingStatus } from '@homer-io/shared';

interface OnboardingState {
  status: OnboardingStatus | null;
  loading: boolean;
  fetchStatus: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  status: null,
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
  completeOnboarding: async () => {
    await api.post('/onboarding/complete');
    set({ status: { completed: true, currentStep: 5, steps: [] } });
  },
  skipOnboarding: async () => {
    await api.post('/onboarding/skip');
    set({ status: { completed: true, currentStep: 5, steps: [] } });
  },
}));
