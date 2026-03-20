import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore } from './demo.js';
import { useOrdersStore } from './orders.js';
import { useFleetStore } from './fleet.js';
import { useRoutesStore } from './routes.js';
import { useSettingsStore } from './settings.js';

/**
 * Tests that write operations in each store are blocked when demo mode is active.
 * These tests verify the guard integration — they don't hit any API,
 * because the guard throws before any network call is made.
 */

describe('Demo mode write guards - Orders', () => {
  beforeEach(() => {
    useDemoStore.setState({ isDemoMode: true });
  });

  it('blocks createOrder', async () => {
    await expect(useOrdersStore.getState().createOrder({})).rejects.toThrow(
      /disabled in demo mode/,
    );
  });

  it('blocks deleteOrder', async () => {
    await expect(useOrdersStore.getState().deleteOrder('test-id')).rejects.toThrow(
      /disabled in demo mode/,
    );
  });

  it('blocks importCsv', async () => {
    await expect(useOrdersStore.getState().importCsv([])).rejects.toThrow(
      /disabled in demo mode/,
    );
  });
});

describe('Demo mode write guards - Fleet', () => {
  beforeEach(() => {
    useDemoStore.setState({ isDemoMode: true });
  });

  it('blocks createVehicle', async () => {
    await expect(
      useFleetStore.getState().createVehicle({ name: 'Test', type: 'van' } as never),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks updateVehicle', async () => {
    await expect(
      useFleetStore.getState().updateVehicle('id', {} as never),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks deleteVehicle', async () => {
    await expect(
      useFleetStore.getState().deleteVehicle('id'),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks createDriver', async () => {
    await expect(
      useFleetStore.getState().createDriver({ name: 'Test' } as never),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks updateDriver', async () => {
    await expect(
      useFleetStore.getState().updateDriver('id', {} as never),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks deleteDriver', async () => {
    await expect(
      useFleetStore.getState().deleteDriver('id'),
    ).rejects.toThrow(/disabled in demo mode/);
  });
});

describe('Demo mode write guards - Routes', () => {
  beforeEach(() => {
    useDemoStore.setState({ isDemoMode: true });
  });

  it('blocks createRoute', async () => {
    await expect(
      useRoutesStore.getState().createRoute({} as never),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks updateRoute', async () => {
    await expect(
      useRoutesStore.getState().updateRoute('id', {} as never),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks deleteRoute', async () => {
    await expect(
      useRoutesStore.getState().deleteRoute('id'),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks optimizeRoute', async () => {
    await expect(
      useRoutesStore.getState().optimizeRoute('id'),
    ).rejects.toThrow(/disabled in demo mode/);
  });
});

describe('Demo mode write guards - Settings', () => {
  beforeEach(() => {
    useDemoStore.setState({ isDemoMode: true });
  });

  it('blocks updateSettings', async () => {
    await expect(
      useSettingsStore.getState().updateSettings({} as never),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks inviteUser', async () => {
    await expect(
      useSettingsStore.getState().inviteUser({ email: 'test@test.com', name: 'Test', role: 'viewer' as never }),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks createApiKey', async () => {
    await expect(
      useSettingsStore.getState().createApiKey({ name: 'Test', scopes: ['read'] }),
    ).rejects.toThrow(/disabled in demo mode/);
  });

  it('blocks revokeApiKey', async () => {
    await expect(
      useSettingsStore.getState().revokeApiKey('id'),
    ).rejects.toThrow(/disabled in demo mode/);
  });
});
