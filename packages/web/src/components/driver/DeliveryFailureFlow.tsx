import { useState } from 'react';
import { PhotoCapture } from './PhotoCapture.js';
import { useDriverStore } from '../../stores/driver.js';
import { C, F, alpha } from '../../theme.js';
import { LoadingSpinner } from '../LoadingSpinner.js';

interface DeliveryFailureFlowProps {
  orderId: string;
  routeId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const FAILURE_REASONS = [
  { value: 'not_home', label: 'Recipient Not Home' },
  { value: 'refused', label: 'Delivery Refused' },
  { value: 'wrong_address', label: 'Wrong Address' },
  { value: 'damaged', label: 'Package Damaged' },
  { value: 'other', label: 'Other' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DeliveryFailureFlow({ orderId, routeId, onComplete, onCancel }: DeliveryFailureFlowProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { uploadPodFiles, createPod, completeStop } = useDriverStore();

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);

    try {
      // Upload photos if any
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        const files = await Promise.all(
          photos.map(async (photo) => ({
            data: await fileToBase64(photo),
            filename: photo.name || `failure-photo-${Date.now()}.jpg`,
            contentType: photo.type || 'image/jpeg',
          })),
        );
        photoUrls = await uploadPodFiles(orderId, files);
      }

      // Get current position
      let locationLat: number | undefined;
      let locationLng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        locationLat = pos.coords.latitude;
        locationLng = pos.coords.longitude;
      } catch {
        // GPS not available
      }

      // Create POD record if we have photos
      if (photoUrls.length > 0) {
        await createPod(orderId, {
          photoUrls,
          notes: `FAILED: ${FAILURE_REASONS.find((r) => r.value === reason)?.label}${notes ? ` - ${notes}` : ''}`,
          locationLat,
          locationLng,
        });
      }

      // Complete the stop as failed
      const failureReason = `${FAILURE_REASONS.find((r) => r.value === reason)?.label}${notes ? `: ${notes}` : ''}`;
      await completeStop(routeId, orderId, {
        status: 'failed',
        failureReason,
      });

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report delivery failure');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <LoadingSpinner />
        <p style={{ color: C.dim, marginTop: 16, fontSize: 14 }}>
          Submitting failure report...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <h3 style={{ fontFamily: F.display, fontSize: 16, margin: 0, color: C.red }}>
        Report Failed Delivery
      </h3>

      {/* Failure reason selector */}
      <div>
        <label style={{ fontSize: 13, color: C.dim, display: 'block', marginBottom: 8 }}>
          Reason for failure *
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {FAILURE_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: reason === r.value ? alpha(C.red, 0.08) : C.bg3,
                border: `1px solid ${reason === r.value ? C.red : C.border}`,
                borderRadius: 8,
                color: reason === r.value ? C.red : C.text,
                fontSize: 14,
                fontFamily: F.body,
                cursor: 'pointer',
                textAlign: 'left',
                minHeight: 44,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: `2px solid ${reason === r.value ? C.red : C.muted}`,
                background: reason === r.value ? C.red : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {reason === r.value && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                )}
              </div>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Optional photo */}
      <div>
        <label style={{ fontSize: 13, color: C.dim, display: 'block', marginBottom: 8 }}>
          Photo evidence (optional)
        </label>
        <PhotoCapture photos={photos} onChange={setPhotos} maxPhotos={2} />
      </div>

      {/* Notes */}
      <div>
        <label style={{ fontSize: 13, color: C.dim, display: 'block', marginBottom: 8 }}>
          Additional notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe the situation..."
          maxLength={500}
          style={{
            width: '100%',
            minHeight: 80,
            padding: 12,
            background: C.bg3,
            border: `1px solid ${C.muted}`,
            borderRadius: 8,
            color: C.text,
            fontSize: 14,
            fontFamily: F.body,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {error && (
        <div style={{
          padding: 12, borderRadius: 8, background: alpha(C.red, 0.08),
          border: `1px solid ${alpha(C.red, 0.19)}`, color: C.red, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '14px 16px',
            background: 'transparent',
            border: `1px solid ${C.muted}`,
            borderRadius: 8,
            color: C.dim,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: F.body,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!reason}
          style={{
            flex: 1,
            padding: '14px 16px',
            background: reason ? C.red : C.muted,
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: F.body,
            cursor: reason ? 'pointer' : 'not-allowed',
            opacity: reason ? 1 : 0.5,
            minHeight: 44,
          }}
        >
          Report Failure
        </button>
      </div>
    </div>
  );
}
