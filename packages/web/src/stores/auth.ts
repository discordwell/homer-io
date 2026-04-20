import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserResponse, AuthResponse, OrgOption } from '@homer-io/shared';

interface PendingGoogleUser {
  credential: string;
  email: string;
  name: string;
  orgOptions: OrgOption[];
}

interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  pendingGoogleUser: PendingGoogleUser | null;
  setAuth: (response: AuthResponse) => void;
  setPendingGoogleUser: (pending: PendingGoogleUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      pendingGoogleUser: null,
      setAuth: (response: AuthResponse) =>
        set({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          isAuthenticated: true,
          pendingGoogleUser: null,
        }),
      setPendingGoogleUser: (pending: PendingGoogleUser | null) =>
        set({ pendingGoogleUser: pending }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          pendingGoogleUser: null,
        }),
    }),
    {
      name: 'homer-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Clear stale demo tokens that may persist if user hard-navigated
        // away from /demo without React cleanup running
        if (state.accessToken === 'demo-token') {
          state.logout();
        }
        // Always clear pendingGoogleUser on rehydrate. The Google OAuth
        // credential is a short-lived JWT and should not survive a reload:
        // if a user navigates away from /org-choice mid-flow and returns
        // later, the credential would be stale. Force a fresh sign-in.
        if (state.pendingGoogleUser) {
          state.pendingGoogleUser = null;
        }
      },
    },
  ),
);
