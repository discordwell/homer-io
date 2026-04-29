/**
 * Poll-fallback scheduler for telematics connections.
 *
 * Runs once per process (PG advisory lock ensures only one API instance
 * polls at a time, so horizontal scale-out is safe). Every 60s, claims
 * `telematics_sync_state` rows whose next_due_at is in the past, calls the
 * adapter's fetchLatestPositions, and advances the watermark + next_due_at.
 *
 * Webhooks are preferred for real-time updates; this poller exists to catch
 * missed events and to cover providers where webhook registration failed.
 */

import { and, eq, lte } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { telematicsConnections } from '../../lib/db/schema/telematics-connections.js';
import { telematicsSyncState } from '../../lib/db/schema/telematics-sync-state.js';
import { telematicsPositions } from '../../lib/db/schema/telematics-positions.js';
import { telematicsExternalVehicles } from '../../lib/db/schema/telematics-external-vehicles.js';
import { getTelematicsAdapter, type TelematicsProvider, type AuthMaterial, type NormalizedPosition } from '../../lib/telematics/index.js';
import { logger } from '../../lib/logger.js';
import { encrypt, decrypt } from '../../lib/integrations/crypto.js';
import { mergePosition, type LocationSource } from '../tracking/service.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { sql } from 'drizzle-orm';

const ADVISORY_LOCK_ID = BigInt('0x74656c656d6174'); // 'telemat' — process-wide poll lock
const POLL_INTERVAL_MS = 60_000;
const PER_DOMAIN_CADENCE_MS: Record<'vehicles' | 'drivers' | 'positions', number> = {
  vehicles: 15 * 60_000, // 15 min — fleet composition changes slowly
  drivers: 15 * 60_000,
  positions: 60_000,     // 1 min — fallback when webhook missed
};

let intervalHandle: NodeJS.Timeout | null = null;

/**
 * Per-connection refresh mutex. Two concurrent polls for different domains on
 * the same connection must not both hit /oauth2/token concurrently — Samsara
 * single-use refresh tokens mean the second call burns a now-invalid token and
 * flips the connection to pending_reauth. One in-flight refresh per connection,
 * others await the same Promise.
 */
const refreshInFlight = new Map<string, Promise<AuthMaterial | null>>();

function decryptAuth(stored: unknown): AuthMaterial {
  if (!stored || typeof stored !== 'object' || !('ciphertext' in stored)) throw new Error('Invalid auth_material');
  return JSON.parse(decrypt((stored as { ciphertext: string }).ciphertext)) as AuthMaterial;
}

function encryptAuth(auth: AuthMaterial): { ciphertext: string } {
  return { ciphertext: encrypt(JSON.stringify(auth)) };
}

async function tryAcquireLock(): Promise<boolean> {
  const result = await db.execute(sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) AS locked`);
  const row = (result as unknown as { rows?: Array<{ locked: boolean }> }).rows?.[0]
    ?? (result as unknown as Array<{ locked: boolean }>)[0];
  return Boolean(row?.locked);
}

export async function runPollCycle(now: Date = new Date()): Promise<void> {
  const due = await db.select({
    id: telematicsSyncState.id,
    connectionId: telematicsSyncState.connectionId,
    domain: telematicsSyncState.domain,
  }).from(telematicsSyncState)
    .where(lte(telematicsSyncState.nextDueAt, now));

  for (const row of due) {
    try {
      await runDomainOnce(row.connectionId, row.domain);
      const cadence = PER_DOMAIN_CADENCE_MS[row.domain];
      await db.update(telematicsSyncState)
        .set({ lastRunAt: now, lastError: null, nextDueAt: new Date(now.getTime() + cadence) })
        .where(eq(telematicsSyncState.id, row.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ err, connectionId: row.connectionId, domain: row.domain }, '[telematics] poll cycle error');
      await db.update(telematicsSyncState)
        .set({ lastRunAt: now, lastError: message.slice(0, 1000), nextDueAt: new Date(now.getTime() + PER_DOMAIN_CADENCE_MS[row.domain]) })
        .where(eq(telematicsSyncState.id, row.id));
    }
  }
}

async function runDomainOnce(connectionId: string, domain: 'vehicles' | 'drivers' | 'positions'): Promise<void> {
  const [conn] = await db.select().from(telematicsConnections)
    .where(eq(telematicsConnections.id, connectionId))
    .limit(1);
  if (!conn || conn.status !== 'active') return;
  const adapter = getTelematicsAdapter(conn.provider as TelematicsProvider);
  let auth = decryptAuth(conn.authMaterial);

  const attempt = async (): Promise<unknown> => {
    if (domain === 'positions' && adapter.fetchLatestPositions) {
      return adapter.fetchLatestPositions(auth);
    }
    if (domain === 'vehicles' && adapter.listVehicles) {
      return adapter.listVehicles(auth);
    }
    return null;
  };

  let result: unknown;
  try {
    result = await attempt();
  } catch {
    // Serialize refresh per connection; two concurrent domains polling the
    // same connection must share one refresh call. Single-use refresh tokens
    // mean parallel refreshes burn each other.
    logger.warn({ connectionId, domain }, '[telematics] primary call failed, attempting refresh');
    let refreshPromise = refreshInFlight.get(connectionId);
    if (!refreshPromise) {
      refreshPromise = adapter.refreshAuth(auth).finally(() => {
        refreshInFlight.delete(connectionId);
      });
      refreshInFlight.set(connectionId, refreshPromise);
    }
    const refreshed = await refreshPromise;
    if (!refreshed) {
      await db.update(telematicsConnections)
        .set({ status: 'pending_reauth', disabledReason: 'refresh failed', updatedAt: new Date() })
        .where(eq(telematicsConnections.id, connectionId));
      return;
    }
    auth = refreshed;
    await db.update(telematicsConnections)
      .set({ authMaterial: encryptAuth(auth), updatedAt: new Date() })
      .where(eq(telematicsConnections.id, connectionId));
    result = await attempt();
  }

  if (domain === 'positions' && Array.isArray(result)) {
    for (const p of result as NormalizedPosition[]) {
      await ingestPollPosition(conn.id, conn.tenantId, conn.provider as TelematicsProvider, p);
    }
  }
  // Vehicles sync on poll is best-effort; we rely on completeConnect's initial sweep.

  await db.update(telematicsConnections)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(telematicsConnections.id, connectionId));
}

async function ingestPollPosition(
  connectionId: string,
  tenantId: string,
  provider: TelematicsProvider,
  p: NormalizedPosition,
): Promise<void> {
  await db.insert(telematicsPositions).values({
    connectionId,
    externalVehicleId: p.externalVehicleId,
    lat: p.lat.toString(),
    lng: p.lng.toString(),
    speed: p.speed?.toString() ?? null,
    heading: p.heading ?? null,
    recordedAt: p.recordedAt,
  });

  const [ev] = await db.select({ mappedVehicleId: telematicsExternalVehicles.mappedVehicleId })
    .from(telematicsExternalVehicles)
    .where(and(
      eq(telematicsExternalVehicles.connectionId, connectionId),
      eq(telematicsExternalVehicles.externalVehicleId, p.externalVehicleId),
    ))
    .limit(1);
  const mappedVehicleId = ev?.mappedVehicleId ?? null;
  if (!mappedVehicleId) return;

  const [driverRow] = await db.select({ id: drivers.id })
    .from(drivers)
    .where(and(eq(drivers.tenantId, tenantId), eq(drivers.currentVehicleId, mappedVehicleId)))
    .limit(1);

  await mergePosition({
    tenantId,
    driverId: driverRow?.id ?? null,
    vehicleId: mappedVehicleId,
    source: provider as LocationSource,
    lat: p.lat,
    lng: p.lng,
    speed: p.speed,
    heading: p.heading,
    recordedAt: p.recordedAt,
  });
}

/**
 * Start the background poll loop. Idempotent — safe to call once from
 * server.ts. The advisory lock ensures only one process polls at a time
 * under horizontal scale-out.
 */
export async function startTelematicsPollScheduler(): Promise<void> {
  if (intervalHandle) return;
  const locked = await tryAcquireLock();
  if (!locked) {
    logger.info('[telematics] another instance holds the poll lock; scheduler idle here');
    return;
  }
  logger.info('[telematics] poll scheduler started');
  intervalHandle = setInterval(() => {
    runPollCycle().catch(err => logger.error({ err }, '[telematics] poll cycle crashed'));
  }, POLL_INTERVAL_MS);
  // Don't hold the process open just for this.
  intervalHandle.unref?.();
}

export function stopTelematicsPollScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
