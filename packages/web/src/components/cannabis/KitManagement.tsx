import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F, alpha } from '../../theme.js';
import { ReconciliationView } from './ReconciliationView.js';

interface KitItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  weight: number;
  sku?: string;
}

interface Kit {
  id: string;
  status: 'loading' | 'loaded' | 'in_transit' | 'reconciling' | 'reconciled';
  routeId: string;
  driverName: string;
  items: KitItem[];
  totalValue: number;
  totalWeight: number;
  createdAt: string;
}

const STATUS_COLORS: Record<Kit['status'], string> = {
  loading: C.yellow,
  loaded: C.accent,
  in_transit: C.green,
  reconciling: C.orange,
  reconciled: C.muted,
};

const STATUS_LABELS: Record<Kit['status'], string> = {
  loading: 'Loading',
  loaded: 'Loaded',
  in_transit: 'In Transit',
  reconciling: 'Reconciling',
  reconciled: 'Reconciled',
};

export function KitManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [kits, setKits] = useState<Kit[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reconcilingKitId, setReconcilingKitId] = useState<string | null>(null);

  useEffect(() => {
    loadKits();
  }, []);

  async function loadKits() {
    setLoading(true);
    try {
      const data = await api.get<Kit[]>('/cannabis/kits?limit=50');
      setKits(data);
    } catch {
      toast('Failed to load kits', 'error');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(kitId: string) {
    setExpandedId(prev => prev === kitId ? null : kitId);
  }

  async function startReconciliation(kitId: string) {
    try {
      await api.post(`/cannabis/kits/${kitId}/reconcile/start`);
      toast('Reconciliation started', 'success');
      setReconcilingKitId(kitId);
      loadKits();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start reconciliation', 'error');
    }
  }

  if (reconcilingKitId) {
    return (
      <ReconciliationView
        kitId={reconcilingKitId}
        onClose={() => {
          setReconcilingKitId(null);
          loadKits();
        }}
      />
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
      padding: 24, width: '100%',
    }}>
      <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 20, color: C.text }}>
        Driver Kits
      </h3>

      {kits.length === 0 ? (
        <p style={{ color: C.dim, fontSize: 14 }}>
          No kits found. Kits are created when a driver loads products for a delivery route.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontFamily: F.body, fontSize: 13,
          }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Status', 'Route', 'Driver', 'Items', 'Value', 'Weight', 'Created'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 12px', color: C.dim,
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {h}
                  </th>
                ))}
                <th style={{ width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {kits.map(kit => (
                <KitRow
                  key={kit.id}
                  kit={kit}
                  expanded={expandedId === kit.id}
                  onToggle={() => toggleExpand(kit.id)}
                  onStartReconciliation={() => startReconciliation(kit.id)}
                  onOpenReconciliation={() => setReconcilingKitId(kit.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KitRow({ kit, expanded, onToggle, onStartReconciliation, onOpenReconciliation }: {
  kit: Kit;
  expanded: boolean;
  onToggle: () => void;
  onStartReconciliation: () => void;
  onOpenReconciliation: () => void;
}) {
  const statusColor = STATUS_COLORS[kit.status];
  const colCount = 8;

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          borderBottom: expanded ? 'none' : `1px solid ${C.border}`,
          background: expanded ? alpha(C.accent, 0.04) : 'transparent',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = alpha(C.accent, 0.06); }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = expanded ? alpha(C.accent, 0.04) : 'transparent'; }}
      >
        <td style={{ padding: '10px 12px' }}>
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 4,
            background: statusColor, color: '#000', fontWeight: 600, fontSize: 11,
          }}>
            {STATUS_LABELS[kit.status]}
          </span>
        </td>
        <td style={{ padding: '10px 12px', color: C.text, fontFamily: F.mono, fontSize: 12 }}>
          {kit.routeId.length > 8 ? `${kit.routeId.slice(0, 8)}...` : kit.routeId}
        </td>
        <td style={{ padding: '10px 12px', color: C.text }}>
          {kit.driverName}
        </td>
        <td style={{ padding: '10px 12px', color: C.text }}>
          {kit.items.length}
        </td>
        <td style={{ padding: '10px 12px', color: C.text }}>
          ${kit.totalValue.toFixed(2)}
        </td>
        <td style={{ padding: '10px 12px', color: C.text }}>
          {kit.totalWeight.toFixed(1)}g
        </td>
        <td style={{ padding: '10px 12px', color: C.dim, fontSize: 12 }}>
          {new Date(kit.createdAt).toLocaleDateString()}
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
          <span style={{
            display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s', color: C.dim, fontSize: 12,
          }}>
            &#9660;
          </span>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={colCount} style={{
            padding: '0 12px 12px', borderBottom: `1px solid ${C.border}`,
            background: alpha(C.accent, 0.04),
          }}>
            <div style={{
              background: C.bg3, borderRadius: 8, padding: 16, marginTop: 4,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 12,
              }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>
                  Kit Items ({kit.items.length})
                </span>
                {kit.status === 'in_transit' && (
                  <button
                    onClick={e => { e.stopPropagation(); onStartReconciliation(); }}
                    style={{
                      padding: '6px 14px', borderRadius: 6, background: C.orange,
                      border: 'none', color: '#000', cursor: 'pointer',
                      fontFamily: F.body, fontWeight: 600, fontSize: 12,
                    }}
                  >
                    Start Reconciliation
                  </button>
                )}
                {kit.status === 'reconciling' && (
                  <button
                    onClick={e => { e.stopPropagation(); onOpenReconciliation(); }}
                    style={{
                      padding: '6px 14px', borderRadius: 6, background: C.accent,
                      border: 'none', color: '#000', cursor: 'pointer',
                      fontFamily: F.body, fontWeight: 600, fontSize: 12,
                    }}
                  >
                    Continue Reconciliation
                  </button>
                )}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Product', 'SKU', 'Qty', 'Unit Price', 'Weight'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '6px 8px', color: C.dim,
                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kit.items.map(item => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '6px 8px', color: C.text }}>{item.productName}</td>
                      <td style={{ padding: '6px 8px', color: C.dim, fontFamily: F.mono }}>
                        {item.sku || '--'}
                      </td>
                      <td style={{ padding: '6px 8px', color: C.text }}>{item.quantity}</td>
                      <td style={{ padding: '6px 8px', color: C.text }}>${item.unitPrice.toFixed(2)}</td>
                      <td style={{ padding: '6px 8px', color: C.text }}>{item.weight.toFixed(1)}g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
