import NetInfo from '@react-native-community/netinfo';
import { storage } from './mmkv';
import { api } from '@/api/client';

const QUEUE_KEY = 'homer_offline_pod_queue';

export interface OfflinePOD {
  id: string;
  orderId: string;
  routeId: string;
  photos: Array<{ base64: string; filename: string }>;
  signatureBase64?: string;
  notes?: string;
  recipientName: string;
  locationLat?: number;
  locationLng?: number;
  queuedAt: number;
}

/** Get all queued PODs */
function getQueue(): OfflinePOD[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflinePOD[];
  } catch {
    return [];
  }
}

/** Save queue back to MMKV */
function saveQueue(queue: OfflinePOD[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

/** Add a POD to the offline queue */
export function queueOfflinePOD(pod: OfflinePOD): void {
  const queue = getQueue();
  queue.push(pod);
  saveQueue(queue);
  console.log(`[OfflineQueue] Queued POD for order ${pod.orderId} (${queue.length} in queue)`);
}

/** Remove a specific POD from the queue */
function removeFromQueue(id: string): void {
  const queue = getQueue().filter((p) => p.id !== id);
  saveQueue(queue);
}

/** Get the number of queued items */
export function getQueueLength(): number {
  return getQueue().length;
}

/** Process a single queued POD */
async function processPOD(pod: OfflinePOD): Promise<boolean> {
  try {
    let photoUrls: string[] = [];
    let signatureUrl: string | undefined;

    // Upload photos
    if (pod.photos.length > 0) {
      const files = pod.photos.map((p) => ({
        data: p.base64,
        filename: p.filename,
        contentType: 'image/jpeg',
      }));
      const result = await api.post<{ urls: string[] }>('/pod/upload', { orderId: pod.orderId, files });
      photoUrls = result.urls;
    }

    // Upload signature
    if (pod.signatureBase64) {
      const sigData = pod.signatureBase64.split(',')[1] || pod.signatureBase64;
      const sigUrls = await api.post<{ urls: string[] }>('/pod/upload', {
        orderId: pod.orderId,
        files: [{ data: sigData, filename: `signature-${Date.now()}.png`, contentType: 'image/png' }],
      });
      signatureUrl = sigUrls.urls[0];
    }

    // Create POD record
    await api.post(`/pod/${pod.orderId}`, {
      signatureUrl,
      photoUrls,
      notes: pod.notes || undefined,
      recipientNameSigned: pod.recipientName,
      locationLat: pod.locationLat,
      locationLng: pod.locationLng,
    });

    // Complete the stop
    await api.post(`/routes/${pod.routeId}/stops/${pod.orderId}/complete`, { status: 'delivered' });

    removeFromQueue(pod.id);
    console.log(`[OfflineQueue] Synced POD for order ${pod.orderId}`);
    return true;
  } catch (err) {
    console.error(`[OfflineQueue] Failed to sync POD ${pod.orderId}:`, err);
    return false;
  }
}

/** Attempt to sync all queued PODs */
export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    return { synced: 0, failed: 0 };
  }

  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  console.log(`[OfflineQueue] Syncing ${queue.length} queued PODs`);

  let synced = 0;
  let failed = 0;

  // Process sequentially to avoid overwhelming the server
  for (const pod of queue) {
    const success = await processPOD(pod);
    if (success) synced++;
    else failed++;
  }

  console.log(`[OfflineQueue] Sync complete: ${synced} synced, ${failed} failed`);
  return { synced, failed };
}

/** Start listening for connectivity changes and auto-sync */
export function startOfflineQueueSync(): () => void {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && getQueueLength() > 0) {
      await syncOfflineQueue();
    }
  });
  return unsubscribe;
}
