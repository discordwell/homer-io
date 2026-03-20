import { create } from 'zustand';

interface DemoState {
  /** Whether the app is currently in public demo mode */
  isDemoMode: boolean;
  /** Enter demo mode */
  enterDemo: () => void;
  /** Exit demo mode */
  exitDemo: () => void;
}

export const useDemoStore = create<DemoState>()((set) => ({
  isDemoMode: false,
  enterDemo: () => set({ isDemoMode: true }),
  exitDemo: () => set({ isDemoMode: false }),
}));

/**
 * Guard function for use in stores — throws if in demo mode.
 * Call at the top of any mutation (create, update, delete) handler.
 */
export function guardDemoWrite(actionName = 'This action'): void {
  const { isDemoMode } = useDemoStore.getState();
  if (isDemoMode) {
    throw new Error(`${actionName} is disabled in demo mode. Sign up to get started!`);
  }
}
