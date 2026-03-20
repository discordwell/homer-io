import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/** Shared MMKV instance for general app state */
export const storage = createMMKV({ id: 'homer-app' });

/**
 * Zustand-compatible storage adapter backed by MMKV.
 * Usage: persist({ storage: createJSONStorage(() => mmkvStorage) })
 */
export const mmkvStorage: StateStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  removeItem: (name: string) => {
    storage.remove(name);
  },
};
