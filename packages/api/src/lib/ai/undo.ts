import { randomUUID } from 'crypto';
import { cacheGet, cacheSet, cacheDelete } from '../cache.js';

const UNDO_KEY_PREFIX = 'nlops:undo:';
const UNDO_LIST_PREFIX = 'nlops:undo:list:';
const UNDO_TTL = 900; // 15 minutes

export interface MutationSnapshot {
  snapshotId: string;
  tenantId: string;
  userId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  /** The preview data captured before execution (entity state) */
  beforeState: unknown;
  /** Short description of what was done */
  summary: string;
  timestamp: number;
}

export async function saveMutationSnapshot(
  params: Omit<MutationSnapshot, 'snapshotId' | 'timestamp'>,
): Promise<MutationSnapshot> {
  const snapshot: MutationSnapshot = {
    ...params,
    snapshotId: randomUUID(),
    timestamp: Date.now(),
  };

  // Store the snapshot itself
  await cacheSet(`${UNDO_KEY_PREFIX}${snapshot.tenantId}:${snapshot.snapshotId}`, snapshot, UNDO_TTL);

  // Maintain a list of snapshot IDs per tenant for listing recent actions
  const listKey = `${UNDO_LIST_PREFIX}${snapshot.tenantId}`;
  const list = await cacheGet<string[]>(listKey) || [];
  list.unshift(snapshot.snapshotId);
  // Keep only last 20
  if (list.length > 20) list.length = 20;
  await cacheSet(listKey, list, UNDO_TTL);

  return snapshot;
}

export async function getSnapshot(
  tenantId: string,
  snapshotId: string,
): Promise<MutationSnapshot | null> {
  return cacheGet<MutationSnapshot>(`${UNDO_KEY_PREFIX}${tenantId}:${snapshotId}`);
}

export async function deleteSnapshot(
  tenantId: string,
  snapshotId: string,
): Promise<void> {
  await cacheDelete(`${UNDO_KEY_PREFIX}${tenantId}:${snapshotId}`);

  // Remove from the list
  const listKey = `${UNDO_LIST_PREFIX}${tenantId}`;
  const list = await cacheGet<string[]>(listKey);
  if (list) {
    const filtered = list.filter((id) => id !== snapshotId);
    if (filtered.length > 0) {
      await cacheSet(listKey, filtered, UNDO_TTL);
    } else {
      await cacheDelete(listKey);
    }
  }
}

export async function getRecentSnapshots(
  tenantId: string,
  limit = 10,
): Promise<MutationSnapshot[]> {
  const listKey = `${UNDO_LIST_PREFIX}${tenantId}`;
  const list = await cacheGet<string[]>(listKey);
  if (!list || list.length === 0) return [];

  const snapshots = await Promise.all(
    list.slice(0, limit).map((id) => getSnapshot(tenantId, id)),
  );

  // Filter out expired/null snapshots
  return snapshots.filter((s): s is MutationSnapshot => s !== null);
}
