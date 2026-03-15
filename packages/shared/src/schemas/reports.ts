import { z } from 'zod';

export const reportTypeEnum = z.enum(['daily_summary', 'driver_performance', 'route_efficiency']);
export type ReportType = z.infer<typeof reportTypeEnum>;

export const generateReportSchema = z.object({
  type: reportTypeEnum,
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
export type GenerateReportInput = z.infer<typeof generateReportSchema>;

export const reportScheduleSchema = z.object({
  type: reportTypeEnum,
  cron: z.string(), // cron expression
  recipients: z.array(z.string().email()),
  enabled: z.boolean().default(true),
});
export type ReportScheduleInput = z.infer<typeof reportScheduleSchema>;
