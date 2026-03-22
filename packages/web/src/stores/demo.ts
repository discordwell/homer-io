import { create } from 'zustand';
import { useAuthStore } from './auth.js';
import type { AuthResponse } from '@homer-io/shared';

export type TenantStatus = 'static' | 'provisioning' | 'ready' | 'failed';

interface DemoState {
  /** Whether the app is currently in public demo mode */
  isDemoMode: boolean;
  /** Status of the backend demo tenant provisioning */
  tenantStatus: TenantStatus;
  /** Email used for this demo session (null = gate not yet passed) */
  demoEmail: string | null;
  /** Error message from email validation or provisioning */
  emailError: string | null;
  /** Enter demo mode */
  enterDemo: () => void;
  /** Exit demo mode */
  exitDemo: () => void;
  /** Set email error message */
  setEmailError: (error: string | null) => void;
  /** Provision a real backend tenant with email identification */
  provisionTenant: (email: string, lat?: number, lng?: number) => Promise<void>;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const useDemoStore = create<DemoState>()((set, get) => ({
  isDemoMode: false,
  tenantStatus: 'static',
  demoEmail: null,
  emailError: null,
  enterDemo: () => set({ isDemoMode: true, tenantStatus: 'static', demoEmail: null, emailError: null }),
  exitDemo: () => set({ isDemoMode: false, tenantStatus: 'static', demoEmail: null, emailError: null }),
  setEmailError: (error) => set({ emailError: error }),

  provisionTenant: async (email: string, lat?: number, lng?: number) => {
    const { tenantStatus } = get();
    if (tenantStatus === 'provisioning' || tenantStatus === 'ready') return;

    set({ tenantStatus: 'provisioning', emailError: null });

    try {
      const body: Record<string, string | number> = { email };
      if (lat != null) body.lat = lat;
      if (lng != null) body.lng = lng;

      const res = await fetch(`${API_BASE}/auth/demo-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.message || data?.error || `Demo session failed (${res.status})`;

        if (res.status === 422) {
          set({ tenantStatus: 'static', emailError: message });
          return;
        }
        throw new Error(message);
      }

      const data: AuthResponse = await res.json();

      // Swap auth from demo-token to real JWT
      useAuthStore.getState().setAuth(data);

      set({ tenantStatus: 'ready', demoEmail: email });
    } catch (err) {
      console.error('[demo] Tenant provisioning failed:', err);
      // Reset to static so user can retry the same email without changing input
      set({
        tenantStatus: 'static',
        emailError: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      });
    }
  },
}));

/**
 * Guard function for use in stores — throws if in demo mode
 * with no real tenant provisioned yet.
 * Call at the top of any mutation (create, update, delete) handler.
 */
export function guardDemoWrite(actionName = 'This action'): void {
  const { isDemoMode, tenantStatus } = useDemoStore.getState();
  if (isDemoMode && tenantStatus !== 'ready') {
    throw new Error(`${actionName} is disabled in demo mode. Sign up to get started!`);
  }
}
