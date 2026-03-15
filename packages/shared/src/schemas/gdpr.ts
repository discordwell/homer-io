import { z } from 'zod';

export const dataExportRequestSchema = z.object({
  format: z.enum(['json']).default('json'),
});
export type DataExportRequestInput = z.infer<typeof dataExportRequestSchema>;

export const dataDeletionRequestSchema = z.object({
  confirmPhrase: z.string().min(1),
});
export type DataDeletionRequestInput = z.infer<typeof dataDeletionRequestSchema>;

export const dataDeletionConfirmSchema = z.object({
  token: z.string().min(1),
});
export type DataDeletionConfirmInput = z.infer<typeof dataDeletionConfirmSchema>;
