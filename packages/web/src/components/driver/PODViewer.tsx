import { useEffect, useState } from 'react';
import { Modal } from '../Modal.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { api } from '../../api/client.js';
import { C, F } from '../../theme.js';

interface PodData {
  id: string;
  orderId: string;
  routeId: string | null;
  driverId: string | null;
  signatureUrl: string | null;
  photoUrls: string[];
  notes: string | null;
  recipientNameSigned: string | null;
  locationLat: string | null;
  locationLng: string | null;
  capturedAt: string;
  createdAt: string;
}

interface PODViewerProps {
  orderId: string;
  open: boolean;
  onClose: () => void;
}

export function PODViewer({ orderId, open, onClose }: PODViewerProps) {
  const [pod, setPod] = useState<PodData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api.get<PodData>(`/pod/${orderId}`)
      .then(setPod)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load POD'))
      .finally(() => setLoading(false));
  }, [open, orderId]);

  return (
    <>
      <Modal open={open} onClose={onClose} title="Proof of Delivery" size="md">
        {loading && <LoadingSpinner />}

        {error && (
          <div style={{
            padding: 16, borderRadius: 8, background: `${C.red}15`,
            border: `1px solid ${C.red}30`, color: C.red, fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {pod && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Metadata */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              <div style={{ background: C.bg3, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Signed By
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {pod.recipientNameSigned || 'N/A'}
                </div>
              </div>
              <div style={{ background: C.bg3, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Captured At
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {new Date(pod.capturedAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Photos */}
            {pod.photoUrls.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Photos ({pod.photoUrls.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {pod.photoUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`POD photo ${i + 1}`}
                      onClick={() => setExpandedPhoto(url)}
                      style={{
                        width: '100%',
                        height: 140,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: `1px solid ${C.muted}`,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '0.8'; }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Signature */}
            {pod.signatureUrl && (
              <div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Signature
                </div>
                <img
                  src={pod.signatureUrl}
                  alt="Signature"
                  style={{
                    width: '100%',
                    maxHeight: 120,
                    objectFit: 'contain',
                    background: C.bg3,
                    borderRadius: 8,
                    border: `1px solid ${C.muted}`,
                    padding: 8,
                  }}
                />
              </div>
            )}

            {/* Notes */}
            {pod.notes && (
              <div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Notes
                </div>
                <div style={{
                  background: C.bg3, borderRadius: 8, padding: 12,
                  border: `1px solid ${C.border}`, fontSize: 14, lineHeight: 1.5,
                }}>
                  {pod.notes}
                </div>
              </div>
            )}

            {/* Location mini-map */}
            {pod.locationLat && pod.locationLng && (
              <div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  GPS Location
                </div>
                <div style={{
                  background: C.bg3, borderRadius: 8, padding: 12,
                  border: `1px solid ${C.border}`, fontSize: 14,
                }}>
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${pod.locationLat},${pod.locationLng}&zoom=16&size=500x200&markers=color:red%7C${pod.locationLat},${pod.locationLng}&style=feature:all|element:all|invert_lightness:true`}
                    alt="Delivery location"
                    style={{ width: '100%', borderRadius: 6 }}
                    onError={(e) => {
                      // Fallback: just show coords if Google Maps API isn't configured
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>
                    {Number(pod.locationLat).toFixed(6)}, {Number(pod.locationLng).toFixed(6)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Expanded photo overlay */}
      {expandedPhoto && (
        <div
          onClick={() => setExpandedPhoto(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, cursor: 'pointer',
          }}
        >
          <img
            src={expandedPhoto}
            alt="Expanded POD photo"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}
    </>
  );
}
