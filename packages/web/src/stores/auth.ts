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
    },
  ),
);
