import { useEffect, useState } from 'react';
import { useTelematicsStore, type TelematicsConnectionDetail } from '../../stores/telematics.js';
import { C, F, alpha, primaryBtnStyle } from '../../theme.js';
import { LoadingSpinner } from '../LoadingSpinner.js';

interface Props {
  open: boolean;
  connectionId: string | null;
  onClose: () => void;
}

export function TelematicsDetailPanel({ open, connectionId, onClose }: Props) {
  const { getConnection, startConnect } = useTelematicsStore();
  const [detail, setDetail] = useState<TelematicsConnectionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !connectionId) { setDetail(null); return; }
    setLoading(true);
    getConnection(connectionId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [open, connectionId, getConnection]);

  async function handleReconnect() {
    if (!detail) return;
    const result = await startConnect(detail.provider);
    if (result.kind === 'oauth') {
      sessionStorage.setItem('telematicsState', result.state);
      sessionStorage.setItem('telematicsProvider', detail.provider);
      window.location.href = result.redirectUrl;
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.bg2, borderRadius: 16, border: `1px solid ${C.muted}`,
          padding: 24, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: F.display, fontSize: 18, color: C.text, margin: 0 }}>
            Telematics connection
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        {loading && <LoadingSpinner />}

        {detail && (
          <>
            <Row label="Provider" value={detail.provider} />
            <Row label="Account" value={detail.accountName ?? '—'} />
            <Row label="Status" value={detail.status} tone={detail.status === 'active' ? C.green : detail.status === 'pending_reauth' ? C.yellow : C.red} />
            <Row label="Last sync" value={detail.lastSyncAt ? new Date(detail.lastSyncAt).toLocaleString() : 'Never'} />
            <Row label="Vehicles seen" value={detail.vehicleCount.toString()} />
            <Row label="Vehicles linked" value={`${detail.mappedVehicleCount} / ${detail.vehicleCount}`} />

            {detail.status === 'pending_reauth' && (
              <div style={{
                marginTop: 16, padding: 12, borderRadius: 8, fontSize: 13,
                background: alpha(C.yellow, 0.08), color: C.yellow, border: `1px solid ${alpha(C.yellow, 0.2)}`,
              }}>
                Your access token expired and could not be refreshed automatically. Reconnect to resume syncing.
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <button onClick={handleReconnect} style={primaryBtnStyle}>Reconnect</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.dim, fontFamily: F.body, fontSize: 13 }}>{label}</span>
      <span style={{ color: tone ?? C.text, fontFamily: F.body, fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
