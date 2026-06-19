/**
 * A previously-recorded mapping between an external platform order and a HOMER order.
 */
export interface IntegrationOrderRef {
  externalOrderId: string;
  /** Null when a prior import attempt FAILED (no HOMER order was created). */
  orderId: string | null;
}

/**
 * Build the set of external order IDs that have already been successfully
 * imported — i.e. rows that link to a real HOMER order.
 *
 * Rows with a null `orderId` are prior FAILED attempts and are deliberately
 * excluded so they get retried on the next sync. Treating a failed row as
 * "already synced" (the pre-fix behavior, which keyed dedup off the mere
 * existence of an `integration_orders` row) caused a single transient or
 * validation failure to skip that order on every future sync — silently losing
 * the delivery forever.
 */
export function collectImportedExternalIds(rows: IntegrationOrderRef[]): Set<string> {
  const imported = new Set<string>();
  for (const row of rows) {
    if (row.orderId != null) imported.add(row.externalOrderId);
  }
  return imported;
}
