import { useEffect, useState } from 'react';
import { Badge } from '../Badge.js';
import { ConfirmDialog } from '../ConfirmDialog.js';
import { useToast } from '../Toast.js';
import {
  useTelematicsStore,
  type TelematicsConnectionSummary,
  type TelematicsProviderInfo,
} from '../../stores/telematics.js';
import { C, F, alpha, primaryBtnStyle, secondaryBtnStyle } from '../../theme.js';
import { TelematicsDetailPanel } from './TelematicsDetailPanel.js';
import { TelematicsVehicleLinker } from './TelematicsVehicleLinker.js';

function statusColor(status: string): string {
  switch (status) {
    case 'active': return C.green;
    case 'pending_reauth': return C.yellow;
    case 'error': return C.red;
    default: return C.dim;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return 'live';
    case 'pending_reauth': return 'reauth';
    case 'error': return 'error';
    default: return status;
  }
}

// Lightweight provider glyphs — no real logos, just tinted initials.
function ProviderGlyph({ provider }: { provider: string }) {
  const color =
    provider === 'samsara' ? '#1859f2' :
    provider === 'motive' ? '#ef5a3a' :
    '#0a7';
  const letter = provider[0]?.toUpperCase() ?? '?';
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, background: alpha(color, 0.15), border: `1px solid ${alpha(color, 0.35)}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontFamily: F.display, fontWeight: 700, fontSize: 18,
    }}>
      {letter}
    </div>
  );
}

export function TelematicsSection() {
  const { toast } = useToast();
  const { providers, connections, loadProviders, loadConnections, startConnect, disconnect } = useTelematicsStore();

  const [detailConnectionId, setDetailConnectionId] = useState<string | null>(null);
  const [linkerConnectionId, setLinkerConnectionId] = useState<string | null>(null);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  useEffect(() => {
    loadProviders().catch(err => toast(err instanceof Error ? err.message : 'Failed to load providers', 'error'));
    loadConnections().catch(err => toast(err instanceof Error ? err.message : 'Failed to load connections', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getConnection(provider: string): TelematicsConnectionSummary | undefined {
    return connections.find(c => c.provider === provider);
  }

  async function handleConnect(provider: TelematicsProviderInfo) {
    setConnectingProvider(provider.provider);
    try {
      const result = await startConnect(provider.provider);
      if (result.kind === 'oauth') {
        // Stash state so the callback page can forward it back to complete.
        sessionStorage.setItem('telematicsState', result.state);
        sessionStorage.setItem('telematicsProvider', provider.provider);
        window.location.href = result.redirectUrl;
      } else {
        toast('API-key providers not yet supported in this build', 'info');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start connect', 'error');
    } finally {
      setConnectingProvider(null);
    }
  }

  async function handleDisconnect() {
    if (!disconnectId) return;
    try {
      await disconnect(disconnectId);
      toast('Provider disconnected', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to disconnect', 'error');
    }
    setDisconnectId(null);
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 18, color: C.text, margin: 0, marginBottom: 4 }}>
          Vehicle tracking
        </h2>
        <span style={{ color: C.dim, fontSize: 14, fontFamily: F.body }}>
          Stream truck positions from Samsara, Motive, or Geotab alongside your driver-phone GPS.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {providers.map((provider) => {
          const conn = getConnection(provider.provider);
          const isConnected = !!conn;
          const color = isConnected ? statusColor(conn.status) : C.dim;

          return (
            <div
              key={provider.provider}
              style={{
                background: C.bg2, borderRadius: 14, border: `1px solid ${isConnected ? alpha(color, 0.25) : C.muted}`,
                padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ProviderGlyph provider={provider.provider} />
                  <div>
                    <h3 style={{ fontFamily: F.display, fontSize: 16, color: C.text, margin: 0 }}>
                      {provider.name}
                    </h3>
                    <span style={{ color: C.dim, fontSize: 12, fontFamily: F.body }}>
                      {provider.description}
                    </span>
                  </div>
                </div>
                {isConnected && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    <Badge color={conn.status === 'active' ? 'green' : conn.status === 'pending_reauth' ? 'yellow' : 'red'}>
                      {statusLabel(conn.status)}
                    </Badge>
                  </div>
                )}
              </div>

              {isConnected && conn && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, background: C.bg3,
                  border: `1px solid ${C.border}`, fontSize: 13,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: C.dim, fontFamily: F.body }}>Account</span>
                    <span style={{ color: C.text, fontFamily: F.body }}>
                      {conn.accountName ?? '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: C.dim, fontFamily: F.body }}>Last sync</span>
                    <span style={{ color: C.text, fontFamily: F.body }}>
                      {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  {conn.disabledReason && (
                    <div style={{
                      marginTop: 8, padding: '6px 8px', borderRadius: 6, fontSize: 12,
                      background: alpha(C.red, 0.06), color: C.red, border: `1px solid ${alpha(C.red, 0.15)}`,
                    }}>
                      {conn.disabledReason}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                {isConnected ? (
                  <>
                    <button onClick={() => setDetailConnectionId(conn.id)} style={primaryBtnStyle}>Details</button>
                    <button onClick={() => setLinkerConnectionId(conn.id)} style={secondaryBtnStyle}>Link vehicles</button>
                    <button
                      onClick={() => setDisconnectId(conn.id)}
                      style={{ ...secondaryBtnStyle, color: C.red, borderColor: alpha(C.red, 0.25) }}
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(provider)}
                    disabled={connectingProvider === provider.provider}
                    style={{ ...primaryBtnStyle, opacity: connectingProvider === provider.provider ? 0.5 : 1 }}
                  >
                    {connectingProvider === provider.provider ? 'Starting…' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {providers.length === 0 && (
          <div style={{ color: C.dim, fontFamily: F.body, fontSize: 14, padding: 16 }}>
            No telematics providers available. Check your deployment config.
          </div>
        )}
      </div>

      <TelematicsDetailPanel
        open={!!detailConnectionId}
        connectionId={detailConnectionId}
        onClose={() => setDetailConnectionId(null)}
      />

      <TelematicsVehicleLinker
        open={!!linkerConnectionId}
        connectionId={linkerConnectionId}
        onClose={() => setLinkerConnectionId(null)}
      />

      <ConfirmDialog
        open={!!disconnectId}
        onClose={() => setDisconnectId(null)}
        onConfirm={handleDisconnect}
        title="Disconnect provider"
        message="Upstream vehicle data and position history will be removed. Any Homer vehicles linked to this provider will lose their telematics feed (the driver app continues working). This cannot be undone."
        confirmLabel="Disconnect"
        variant="danger"
      />
    </div>
  );
}
