import { useEffect, useState } from 'react';
import { Badge } from '../Badge.js';
import { ConfirmDialog } from '../ConfirmDialog.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { useIntegrationsStore } from '../../stores/integrations.js';
import { IntegrationConnectForm } from './IntegrationConnectForm.js';
import { IntegrationDetailPanel } from './IntegrationDetailPanel.js';
import { C, F, alpha, primaryBtnStyle, secondaryBtnStyle } from '../../theme.js';
import type { PlatformInfo, ConnectionResponse } from '@homer-io/shared';

// Platform icons (simple SVG inline)
function ShopifyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M15.3 5.6s-.3-.1-.3-.3c0-.2-.2-1.3-.2-1.3s-.1-.1-.2-.1L13 4.2s-.4-.4-.5-.4l-.4 17.2 7-1.5S15.5 6 15.3 5.6zM12 4.2l-.6.2s-.1-.8-.4-1.2c-.5-.3-.6 0-.6 0s.4-.6 1-.3c.5.2.6 1.3.6 1.3zM11.1 4.4l-.6.2S9.8 2 8.5 2c-.1 0-.1 0-.1 0s0-.1.1-.1c1.1-.2 2.1.9 2.6 2.5zM8.8 5l-3.5 1.1s-.3-2.2 1.5-3.3c.1 0 .2-.1.3-.1-.1.1-.2.2-.3.3-.8 1-.5 2-.5 2H8.8z" fill={C.green} />
      <path d="M15 5.3s-.3-.1-.3-.3c0-.2-.2-1.3-.2-1.3L5.3 6.1l1.1 13.2 5.7-1.2L15 5.3z" fill={C.green} fillOpacity="0.3" />
    </svg>
  );
}

function WooCommerceIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="3" fill={C.purple} fillOpacity="0.3" />
      <path d="M6 10c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zM14 10c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zM9 15s1 2 3 2 3-2 3-2" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'shopify': return <ShopifyIcon />;
    case 'woocommerce': return <WooCommerceIcon />;
    default: return null;
  }
}

function syncStatusColor(status: string): string {
  switch (status) {
    case 'syncing': return C.green;
    case 'idle': return C.yellow;
    case 'error': return C.red;
    default: return C.dim;
  }
}

export function IntegrationsTab() {
  const { toast } = useToast();
  const { connections, platforms, loading, loadPlatforms, loadConnections, deleteConnection, testConnection } = useIntegrationsStore();

  const [connectFormOpen, setConnectFormOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformInfo | null>(null);
  const [detailConnection, setDetailConnection] = useState<ConnectionResponse | null>(null);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    loadPlatforms();
    loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getConnectionForPlatform(platform: string): ConnectionResponse | undefined {
    return connections.find(c => c.platform === platform);
  }

  async function handleDisconnect() {
    if (!disconnectId) return;
    try {
      await deleteConnection(disconnectId);
      toast('Integration disconnected', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to disconnect', 'error');
    }
    setDisconnectId(null);
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const success = await testConnection(id);
      toast(success ? 'Connection is healthy' : 'Connection test failed', success ? 'success' : 'error');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Test failed', 'error');
    }
    setTestingId(null);
  }

  if (loading && connections.length === 0 && platforms.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ color: C.dim, fontSize: 14, fontFamily: F.body }}>
          Connect your e-commerce platforms to automatically import orders into HOMER.
        </span>
      </div>

      {/* Platform cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {platforms.map((platform) => {
          const conn = getConnectionForPlatform(platform.platform);
          const isConnected = !!conn;
          const statusColor = isConnected ? syncStatusColor(conn.syncStatus) : C.dim;

          return (
            <div
              key={platform.platform}
              style={{
                background: C.bg2, borderRadius: 14, border: `1px solid ${isConnected ? alpha(statusColor, 0.25) : C.muted}`,
                padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
                transition: 'border-color 0.2s',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {getPlatformIcon(platform.platform)}
                  <div>
                    <h3 style={{ fontFamily: F.display, fontSize: 16, color: C.text, margin: 0 }}>
                      {platform.name}
                    </h3>
                    <span style={{ color: C.dim, fontSize: 12, fontFamily: F.body }}>
                      {platform.description}
                    </span>
                  </div>
                </div>
                {isConnected && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: statusColor,
                      boxShadow: conn.syncStatus === 'syncing' ? `0 0 8px ${alpha(statusColor, 0.38)}` : undefined,
                    }} />
                    <Badge color={conn.syncStatus === 'syncing' ? 'green' : conn.syncStatus === 'error' ? 'red' : 'yellow'}>
                      {conn.syncStatus}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Connected info */}
              {isConnected && conn && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, background: C.bg3,
                  border: `1px solid ${C.border}`, fontSize: 13,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: C.dim, fontFamily: F.body }}>Store</span>
                    <span style={{ color: C.text, fontFamily: F.mono, fontSize: 12 }}>{conn.storeUrl}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: C.dim, fontFamily: F.body }}>Orders</span>
                    <span style={{ color: C.text, fontFamily: F.body, fontWeight: 600 }}>{conn.orderCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: C.dim, fontFamily: F.body }}>Last sync</span>
                    <span style={{ color: C.text, fontFamily: F.body }}>
                      {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              )}

              {/* Error display */}
              {isConnected && conn?.lastSyncError && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 12, fontFamily: F.mono,
                  background: alpha(C.red, 0.06), color: C.red, border: `1px solid ${alpha(C.red, 0.15)}`,
                  wordBreak: 'break-word',
                }}>
                  {conn.lastSyncError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                {isConnected ? (
                  <>
                    <button
                      onClick={() => setDetailConnection(conn)}
                      style={primaryBtnStyle}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => handleTest(conn.id)}
                      disabled={testingId === conn.id}
                      style={{ ...secondaryBtnStyle, opacity: testingId === conn.id ? 0.5 : 1 }}
                    >
                      {testingId === conn.id ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={() => setDisconnectId(conn.id)}
                      style={{ ...secondaryBtnStyle, color: C.red, borderColor: alpha(C.red, 0.25) }}
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setSelectedPlatform(platform); setConnectFormOpen(true); }}
                    style={primaryBtnStyle}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect form modal */}
      <IntegrationConnectForm
        open={connectFormOpen}
        onClose={() => { setConnectFormOpen(false); setSelectedPlatform(null); }}
        platform={selectedPlatform}
      />

      {/* Detail panel modal */}
      <IntegrationDetailPanel
        open={!!detailConnection}
        onClose={() => setDetailConnection(null)}
        connection={detailConnection}
      />

      {/* Disconnect confirm */}
      <ConfirmDialog
        open={!!disconnectId}
        onClose={() => setDisconnectId(null)}
        onConfirm={handleDisconnect}
        title="Disconnect Integration"
        message="Are you sure you want to disconnect this integration? Imported orders will be preserved, but no new orders will be synced. This action cannot be undone."
        confirmLabel="Disconnect"
        variant="danger"
      />
    </div>
  );
}

