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
  industryLoading: boolean;
  sampleDataLoading: boolean;
  fetchStatus: () => Promise<void>;
  fetchProviderStatus: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  skipStep: (stepKey: string) => Promise<{ success: boolean; message: string }>;
  setIndustry: (industry: string) => Promise<void>;
  loadSampleData: () => Promise<{ ordersCreated: number }>;
}

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  status: null,
  providerStatus: null,
  loading: false,
  industryLoading: false,
  sampleDataLoading: false,
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
    set({ status: { completed: true, currentStep: 6, steps: [] } });
  },
  skipOnboarding: async () => {
    await api.post('/onboarding/skip');
    set({ status: { completed: true, currentStep: 6, steps: [] } });
  },
  skipStep: async (stepKey: string) => {
    const result = await api.post<{ success: boolean; message: string }>('/onboarding/skip-step', { stepKey });
    if (result.success) {
      await get().fetchStatus();
    }
    return result;
  },
  setIndustry: async (industry: string) => {
    set({ industryLoading: true });
    try {
      await api.post('/onboarding/set-industry', { industry });
      await get().fetchStatus();
    } finally {
      set({ industryLoading: false });
    }
  },
  loadSampleData: async () => {
    set({ sampleDataLoading: true });
    try {
      const result = await api.post<{ success: boolean; ordersCreated: number }>('/onboarding/load-sample-data');
      return result;
    } finally {
      set({ sampleDataLoading: false });
    }
  },
}));
