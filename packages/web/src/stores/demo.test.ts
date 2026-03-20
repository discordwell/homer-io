import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore, guardDemoWrite } from './demo.js';

describe('useDemoStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useDemoStore.setState({ isDemoMode: false });
  });

  it('starts with isDemoMode = false', () => {
    expect(useDemoStore.getState().isDemoMode).toBe(false);
  });

  it('enterDemo sets isDemoMode to true', () => {
    useDemoStore.getState().enterDemo();
    expect(useDemoStore.getState().isDemoMode).toBe(true);
  });

  it('exitDemo sets isDemoMode back to false', () => {
    useDemoStore.getState().enterDemo();
    useDemoStore.getState().exitDemo();
    expect(useDemoStore.getState().isDemoMode).toBe(false);
  });
});

describe('guardDemoWrite', () => {
  beforeEach(() => {
    useDemoStore.setState({ isDemoMode: false });
  });

  it('does not throw when not in demo mode', () => {
    expect(() => guardDemoWrite('Testing')).not.toThrow();
  });

  it('throws when in demo mode', () => {
    useDemoStore.getState().enterDemo();
    expect(() => guardDemoWrite('Creating orders')).toThrow(
      'Creating orders is disabled in demo mode. Sign up to get started!',
    );
  });

  it('throws with default message when no action name given', () => {
    useDemoStore.getState().enterDemo();
    expect(() => guardDemoWrite()).toThrow(
      'This action is disabled in demo mode. Sign up to get started!',
    );
  });

  it('allows operations again after exiting demo mode', () => {
    useDemoStore.getState().enterDemo();
    expect(() => guardDemoWrite('Test')).toThrow();

    useDemoStore.getState().exitDemo();
    expect(() => guardDemoWrite('Test')).not.toThrow();
  });
});
