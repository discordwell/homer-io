import { create } from 'zustand';
import { useAuthStore } from './auth.js';
import type { AuthResponse } from '@homer-io/shared';

export type TenantStatus = 'static' | 'provisioning' | 'ready' | 'failed';

interface DemoState {
  /** Whether the app is currently in public demo mode */
  isDemoMode: boolean;
  /** Status of the backend demo tenant provisioning */
  tenantStatus: TenantStatus;
  /** Enter demo mode */
  enterDemo: () => void;
  /** Exit demo mode */
  exitDemo: () => void;
  /** Provision a real backend tenant in the background */
  provisionTenant: (lat?: number, lng?: number) => Promise<void>;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const useDemoStore = create<DemoState>()((set, get) => ({
  isDemoMode: false,
  tenantStatus: 'static',
  enterDemo: () => set({ isDemoMode: true, tenantStatus: 'static' }),
  exitDemo: () => set({ isDemoMode: false, tenantStatus: 'static' }),

  provisionTenant: async (lat?: number, lng?: number) => {
    const { tenantStatus } = get();
    if (tenantStatus === 'provisioning' || tenantStatus === 'ready') return;

    set({ tenantStatus: 'provisioning' });

    try {
      const body: Record<string, number> = {};
      if (lat != null) body.lat = lat;
      if (lng != null) body.lng = lng;

      const res = await fetch(`${API_BASE}/auth/demo-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Demo session failed: ${res.status}`);
      }

      const data: AuthResponse = await res.json();

      // Silently swap auth token from demo-token to real JWT
      useAuthStore.getState().setAuth(data);

      set({ tenantStatus: 'ready' });
    } catch (err) {
      console.error('[demo] Tenant provisioning failed:', err);
      set({ tenantStatus: 'failed' });
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
