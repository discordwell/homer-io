import { describe, it, expect, beforeEach } from 'vitest';
import { useOrdersStore } from './orders.js';
import { useRoutesStore } from './routes.js';
import { useFleetStore } from './fleet.js';

/**
 * Regression tests for Finding H13: filter setters must reset pagination to
 * page 1, otherwise a user on page 3 who narrows a filter triggers a fetch
 * for a now-out-of-range page and sees an empty table.
 */

describe('useOrdersStore — filter setters reset page', () => {
  beforeEach(() => {
    useOrdersStore.setState({
      page: 3,
      statusFilter: '',
      search: '',
      dateFrom: '',
      dateTo: '',
    });
  });

  it('setStatusFilter resets page to 1', () => {
    useOrdersStore.getState().setStatusFilter('pending');
    const s = useOrdersStore.getState();
    expect(s.page).toBe(1);
    expect(s.statusFilter).toBe('pending');
  });

  it('setSearch resets page to 1', () => {
    useOrdersStore.getState().setSearch('alice');
    const s = useOrdersStore.getState();
    expect(s.page).toBe(1);
    expect(s.search).toBe('alice');
  });

  it('setDateFrom resets page to 1', () => {
    useOrdersStore.getState().setDateFrom('2026-01-01');
    const s = useOrdersStore.getState();
    expect(s.page).toBe(1);
    expect(s.dateFrom).toBe('2026-01-01');
  });

  it('setDateTo resets page to 1', () => {
    useOrdersStore.getState().setDateTo('2026-12-31');
    const s = useOrdersStore.getState();
    expect(s.page).toBe(1);
    expect(s.dateTo).toBe('2026-12-31');
  });
});

describe('useRoutesStore — filter setter resets page', () => {
  beforeEach(() => {
    useRoutesStore.setState({ page: 4, statusFilter: '' });
  });

  it('setStatusFilter resets page to 1', () => {
    useRoutesStore.getState().setStatusFilter('active');
    const s = useRoutesStore.getState();
    expect(s.page).toBe(1);
    expect(s.statusFilter).toBe('active');
  });
});

describe('useFleetStore — driver filter setters reset driverPage', () => {
  beforeEach(() => {
    useFleetStore.setState({ driverPage: 5, driverStatusFilter: '', driverSearch: '' });
  });

  it('setDriverStatusFilter resets driverPage to 1', () => {
    useFleetStore.getState().setDriverStatusFilter('available');
    const s = useFleetStore.getState();
    expect(s.driverPage).toBe(1);
    expect(s.driverStatusFilter).toBe('available');
  });

  it('setDriverSearch resets driverPage to 1', () => {
    useFleetStore.getState().setDriverSearch('bob');
    const s = useFleetStore.getState();
    expect(s.driverPage).toBe(1);
    expect(s.driverSearch).toBe('bob');
  });
});
