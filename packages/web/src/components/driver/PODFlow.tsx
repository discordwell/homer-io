import { useState } from 'react';
import { PhotoCapture } from './PhotoCapture.js';
import { SignaturePad } from './SignaturePad.js';
import { useDriverStore } from '../../stores/driver.js';
import { C, F, alpha } from '../../theme.js';
import { LoadingSpinner } from '../LoadingSpinner.js';

interface PODFlowProps {
  orderId: string;
  routeId: string;
  recipientName: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Step = 'photo' | 'signature' | 'notes' | 'confirm';

const STEPS: Step[] = ['photo', 'signature', 'notes', 'confirm'];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PODFlow({ orderId, routeId, recipientName, onComplete, onCancel }: PODFlowProps) {
  const [step, setStep] = useState<Step>('photo');
  const [photos, setPhotos] = useState<File[]>([]);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { uploadPodFiles, createPod, completeStop } = useDriverStore();

  const stepIndex = STEPS.indexOf(step);

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      let photoUrls: string[] = [];
      let signatureUrl: string | undefined;

      // Upload photos
      if (photos.length > 0) {
        const files = await Promise.all(
          photos.map(async (photo) => ({
            data: await fileToBase64(photo),
            filename: photo.name || `photo-${Date.now()}.jpg`,
            contentType: photo.type || 'image/jpeg',
          })),
        );
        photoUrls = await uploadPodFiles(orderId, files);
      }

      // Upload signature
      if (signatureBase64) {
        const sigData = signatureBase64.split(',')[1] || signatureBase64;
        const sigUrls = await uploadPodFiles(orderId, [{
          data: sigData,
          filename: `signature-${Date.now()}.png`,
          contentType: 'image/png',
        }]);
        signatureUrl = sigUrls[0];
      }

      // Get current position for POD
      let locationLat: number | undefined;
      let locationLng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        locationLat = pos.coords.latitude;
        locationLng = pos.coords.longitude;
      } catch {
        // GPS not available — continue without
      }

      // Create the POD record
      await createPod(orderId, {
        signatureUrl,
        photoUrls,
        notes: notes || undefined,
        recipientNameSigned: recipientName,
        locationLat,
        locationLng,
      });

      // Complete the stop
      await completeStop(routeId, orderId, { status: 'delivered' });

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit delivery proof');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <LoadingSpinner />
        <p style={{ color: C.dim, marginTop: 16, fontSize: 14 }}>
          Uploading delivery proof...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Step indicator */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '16px 16px 12px',
        background: C.bg2,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i <= stepIndex ? C.accent : C.muted,
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      {/* Header */}
      <div style={{ padding: '12px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontFamily: F.display, fontSize: 16, margin: 0, color: C.text }}>
          {step === 'photo' && 'Take Photos'}
          {step === 'signature' && 'Get Signature'}
          {step === 'notes' && 'Add Notes'}
          {step === 'confirm' && 'Confirm Delivery'}
        </h3>
        <button
          onClick={onCancel}
          style={{
            background: 'none', border: 'none', color: C.dim, cursor: 'pointer',
            fontSize: 14, fontFamily: F.body, minWidth: 44, minHeight: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          Cancel
        </button>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, padding: 16 }}>
        {step === 'photo' && (
          <div>
            <p style={{ color: C.dim, fontSize: 13, marginBottom: 16, marginTop: 0 }}>
              Take photos of the delivered package at the doorstep
            </p>
            <PhotoCapture photos={photos} onChange={setPhotos} />
          </div>
        )}

        {step === 'signature' && (
          <div>
            <p style={{ color: C.dim, fontSize: 13, marginBottom: 16, marginTop: 0 }}>
              Have the recipient sign below
            </p>
            <SignaturePad
              onAccept={(sig) => {
                setSignatureBase64(sig);
                goNext();
              }}
            />
            {signatureBase64 && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <img
                  src={signatureBase64}
                  alt="Signature"
                  style={{ height: 60, borderRadius: 6, border: `1px solid ${C.muted}` }}
                />
                <p style={{ fontSize: 12, color: C.green, margin: '4px 0 0' }}>Signature captured</p>
              </div>
            )}
          </div>
        )}

        {step === 'notes' && (
          <div>
            <p style={{ color: C.dim, fontSize: 13, marginBottom: 16, marginTop: 0 }}>
              Add any delivery notes (optional)
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Left at front door, handed to neighbor..."
              maxLength={1000}
              style={{
                width: '100%',
                minHeight: 120,
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
            <div style={{ fontSize: 11, color: C.dim, textAlign: 'right', marginTop: 4 }}>
              {notes.length}/1000
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: C.dim, fontSize: 13, marginTop: 0 }}>
              Review delivery proof before submitting
            </p>

            <div style={{ background: C.bg3, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>Recipient</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{recipientName}</div>
            </div>

            <div style={{ background: C.bg3, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>Photos</div>
              <div style={{ fontSize: 15 }}>{photos.length} photo{photos.length !== 1 ? 's' : ''} captured</div>
            </div>

            <div style={{ background: C.bg3, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>Signature</div>
              <div style={{ fontSize: 15 }}>{signatureBase64 ? 'Captured' : 'Not captured'}</div>
            </div>

            {notes && (
              <div style={{ background: C.bg3, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 14 }}>{notes}</div>
              </div>
            )}

            {error && (
              <div style={{
                padding: 12, borderRadius: 8, background: alpha(C.red, 0.08),
                border: `1px solid ${alpha(C.red, 0.19)}`, color: C.red, fontSize: 13,
              }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div style={{
        display: 'flex', gap: 10, padding: 16,
        borderTop: `1px solid ${C.border}`,
        background: C.bg2,
      }}>
        {stepIndex > 0 && step !== 'confirm' && (
          <button
            onClick={goBack}
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
            Back
          </button>
        )}

        {step === 'confirm' ? (
          <>
            <button
              onClick={goBack}
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
              Back
            </button>
            <button
              onClick={handleSubmit}
              style={{
                flex: 2,
                padding: '14px 16px',
                background: C.green,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: F.body,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              Confirm Delivery
            </button>
          </>
        ) : step !== 'signature' ? (
          <button
            onClick={goNext}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: C.accent,
              border: 'none',
              borderRadius: 8,
              color: '#000',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: F.body,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            {step === 'photo' && photos.length === 0 ? 'Skip Photos' : 'Next'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
