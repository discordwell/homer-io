import { eq, and } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { proofOfDelivery } from '../../lib/db/schema/proof-of-delivery.js';
import { orders } from '../../lib/db/schema/orders.js';
import { uploadFile, ensureBucket } from '../../lib/storage/minio.js';
import { findDriverByUserId } from '../tracking/service.js';
import { NotFoundError, HttpError } from '../../lib/errors.js';
import type { CreatePodInput } from '@homer-io/shared';
import { logActivity } from '../../lib/activity.js';

const POD_BUCKET = 'homer-pod';

/**
 * Upload POD files (base64-encoded) to MinIO.
 * Accepts an array of { data: string (base64), filename: string, contentType: string }.
 */
export async function uploadPodFiles(
  tenantId: string,
  orderId: string,
  files: Array<{ data: string; filename: string; contentType: string }>,
): Promise<string[]> {
  await ensureBucket(POD_BUCKET);

  const urls: string[] = [];
  for (const file of files) {
    const buffer = Buffer.from(file.data, 'base64');
    const key = `${tenantId}/${orderId}/${Date.now()}-${file.filename}`;
    const url = await uploadFile(key, buffer, file.contentType, POD_BUCKET);
    urls.push(url);
  }

  return urls;
}

/**
 * Create a Proof of Delivery record for an order.
 */
export async function createPod(
  tenantId: string,
  userId: string,
  orderId: string,
  input: CreatePodInput,
) {
  const driverId = await findDriverByUserId(tenantId, userId);
  if (!driverId) throw new NotFoundError('No driver profile linked to this user');

  // Verify order belongs to tenant
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1);

  if (!order) throw new NotFoundError('Order not found');

  // Insert POD — catch unique constraint violation for idempotency
  try {
    const [pod] = await db
      .insert(proofOfDelivery)
      .values({
        tenantId,
        orderId,
        routeId: order.routeId,
        driverId,
        signatureUrl: input.signatureUrl ?? null,
        photoUrls: input.photoUrls ?? [],
        notes: input.notes ?? null,
        recipientNameSigned: input.recipientNameSigned ?? null,
        locationLat: input.locationLat?.toString() ?? null,
        locationLng: input.locationLng?.toString() ?? null,
        // ID verification (cannabis compliance)
        idPhotoUrl: input.idPhotoUrl ?? null,
        idNumber: input.idNumber ? input.idNumber.slice(-4) : null,
        idDob: input.idDob ?? null,
        idExpirationDate: input.idExpirationDate ?? null,
        idNameOnId: input.idNameOnId ?? null,
        idVerifiedAt: input.idVerifiedAt ? new Date(input.idVerifiedAt) : null,
        ageVerified: input.ageVerified ?? false,
      })
      .returning();

    logActivity({ tenantId, action: 'pod_created', entityType: 'pod', entityId: pod.id, metadata: { orderId } });

    return pod;
  } catch (err: any) {
    // Handle unique constraint violation (race condition or duplicate)
    if (err?.message?.includes('violates') || err?.code === '23505') {
      throw new HttpError(409, 'Proof of delivery already exists for this order');
    }
    throw err;
  }
}

/**
 * Get the Proof of Delivery record for an order.
 */
export async function getPod(tenantId: string, orderId: string) {
  const [pod] = await db
    .select()
    .from(proofOfDelivery)
    .where(
      and(
        eq(proofOfDelivery.orderId, orderId),
        eq(proofOfDelivery.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!pod) throw new NotFoundError('Proof of delivery not found');
  return pod;
}
