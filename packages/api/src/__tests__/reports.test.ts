import { describe, it, expect } from 'vitest';
import { generateReportSchema, reportTypeEnum, reportScheduleSchema } from '@homer-io/shared';

describe('Report schemas', () => {
  it('validates report type enum', () => {
    expect(reportTypeEnum.parse('daily_summary')).toBe('daily_summary');
    expect(reportTypeEnum.parse('driver_performance')).toBe('driver_performance');
    expect(reportTypeEnum.parse('route_efficiency')).toBe('route_efficiency');
    expect(() => reportTypeEnum.parse('custom')).toThrow();
  });

  it('validates generate report request', () => {
    const valid = generateReportSchema.parse({
      type: 'daily_summary',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-14',
    });
    expect(valid.type).toBe('daily_summary');
    expect(valid.dateFrom).toBe('2026-03-01');
  });

  it('allows optional date range', () => {
    const valid = generateReportSchema.parse({ type: 'driver_performance' });
    expect(valid.type).toBe('driver_performance');
    expect(valid.dateFrom).toBeUndefined();
  });

  it('validates report schedule', () => {
    const valid = reportScheduleSchema.parse({
      type: 'daily_summary',
      cron: '0 8 * * *',
      recipients: ['admin@homer.io'],
      enabled: true,
    });
    expect(valid.recipients).toHaveLength(1);
    expect(valid.cron).toBe('0 8 * * *');
  });

  it('rejects invalid email in schedule', () => {
    expect(() =>
      reportScheduleSchema.parse({
        type: 'daily_summary',
        cron: '0 8 * * *',
        recipients: ['not-an-email'],
      }),
    ).toThrow();
  });
});
