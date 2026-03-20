import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/services/mmkv';
import { setTokens, clearTokens, getTokens } from '@/api/client';
import type { UserResponse, AuthResponse } from '@homer-io/shared';

interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  setAuth: (response: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hydrated: false,

      setAuth: async (response: AuthResponse) => {
        // Store tokens in secure storage (encrypted by OS)
        await setTokens(response.accessToken, response.refreshToken);
        set({
          user: response.user,
          isAuthenticated: true,
        });
      },

      logout: async () => {
        await clearTokens();
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'homer-auth',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => async (state) => {
        // Verify tokens still exist in SecureStore — prevents desync
        // if app was killed mid-logout
        if (state?.isAuthenticated) {
          const { accessToken } = await getTokens();
          if (!accessToken) {
            state.logout();
          }
        }
        state?.setHydrated();
      },
    },
  ),
);
