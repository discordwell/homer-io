import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F, alpha } from '../../theme.js';

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
  status: string;
  routeId: string;
  driverName: string;
  items: KitItem[];
  totalValue: number;
  totalWeight: number;
  createdAt: string;
}

interface Discrepancy {
  productName: string;
  loaded: number;
  returned: number;
  difference: number;
}

interface ReconcileResponse {
  success: boolean;
  discrepancies: Discrepancy[];
}

interface Props {
  kitId: string;
  onClose: () => void;
}

export function ReconciliationView({ kitId, onClose }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kit, setKit] = useState<Kit | null>(null);
  const [returnedQtys, setReturnedQtys] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<ReconcileResponse | null>(null);

  useEffect(() => {
    loadKit();
  }, [kitId]);

  async function loadKit() {
    setLoading(true);
    try {
      const data = await api.get<Kit>(`/cannabis/kits/${kitId}`);
      setKit(data);
      // Initialize returned quantities to 0
      const initial: Record<string, number> = {};
      for (const item of data.items) {
        initial[item.id] = 0;
      }
      setReturnedQtys(initial);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load kit', 'error');
    } finally {
      setLoading(false);
    }
  }

  function updateReturnedQty(itemId: string, value: string) {
    const num = parseInt(value, 10);
    setReturnedQtys(prev => ({
      ...prev,
      [itemId]: isNaN(num) ? 0 : Math.max(0, num),
    }));
  }

  function expectedReturned(item: KitItem): number {
    // Expected returned = loaded qty (everything should come back if unsold)
    // Discrepancy means returned != loaded
    return item.quantity;
  }

  async function handleSubmit() {
    if (!kit) return;
    setSubmitting(true);
    try {
      const returnedItems = kit.items.map(item => ({
        itemId: item.id,
        returnedQuantity: returnedQtys[item.id] ?? 0,
      }));
      const response = await api.post<ReconcileResponse>(
        `/cannabis/kits/${kitId}/reconcile`,
        { returnedItems, notes },
      );
      setResult(response);
      toast('Reconciliation submitted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Reconciliation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  if (!kit) {
    return (
      <div style={{ padding: 24, color: C.dim }}>
        Kit not found.{' '}
        <button onClick={onClose} style={{ ...linkBtnStyle }}>Go back</button>
      </div>
    );
  }

  return (
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
      padding: 24, width: '100%',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20,
      }}>
        <div>
          <h3 style={{ fontFamily: F.display, fontSize: 16, color: C.text, margin: 0 }}>
            Kit Reconciliation
          </h3>
          <span style={{ fontSize: 12, color: C.dim, marginTop: 4, display: 'block' }}>
            {kit.driverName} &middot; Route {kit.routeId.slice(0, 8)}... &middot;{' '}
            {new Date(kit.createdAt).toLocaleDateString()}
          </span>
        </div>
        <button onClick={onClose} style={{
          padding: '6px 14px', borderRadius: 6, background: C.bg3,
          border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer',
          fontFamily: F.body, fontSize: 13,
        }}>
          Close
        </button>
      </div>

      {/* Result view after submission */}
      {result && (
        <div style={{
          background: C.bg3, borderRadius: 8, padding: 16, marginBottom: 20,
          border: `1px solid ${result.discrepancies.length > 0 ? C.red : C.green}`,
        }}>
          <h4 style={{ color: C.text, fontSize: 14, marginBottom: 12, fontFamily: F.display }}>
            Reconciliation {result.discrepancies.length > 0 ? 'Completed with Discrepancies' : 'Completed'}
          </h4>
          {result.discrepancies.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.discrepancies.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', borderRadius: 6,
                  background: alpha(C.red, 0.1),
                }}>
                  <span style={{ color: C.text, fontSize: 13 }}>{d.productName}</span>
                  <span style={{ color: C.red, fontSize: 13, fontWeight: 600 }}>
                    Loaded: {d.loaded} &middot; Returned: {d.returned} &middot;
                    Diff: {d.difference > 0 ? '+' : ''}{d.difference}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: C.green, fontSize: 13 }}>
              All items accounted for. No discrepancies found.
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={onClose} style={{
              padding: '8px 20px', borderRadius: 6, background: C.accent,
              border: 'none', color: '#000', cursor: 'pointer',
              fontFamily: F.body, fontWeight: 600, fontSize: 13,
            }}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Side-by-side reconciliation form */}
      {!result && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
            borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}`,
          }}>
            {/* Column headers */}
            <div style={{
              padding: '10px 14px', background: alpha(C.accent, 0.08),
              borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: C.accent,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Loaded
              </span>
            </div>
            <div style={{
              padding: '10px 14px', background: alpha(C.accent, 0.08),
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: C.accent,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Returned
              </span>
            </div>

            {/* Item rows */}
            {kit.items.map(item => {
              const returned = returnedQtys[item.id] ?? 0;
              const expected = expectedReturned(item);
              const hasDiscrepancy = returned !== expected;

              return (
                <div key={item.id} style={{ display: 'contents' }}>
                  {/* Loaded column */}
                  <div style={{
                    padding: '10px 14px',
                    borderBottom: `1px solid ${C.border}`,
                    borderRight: `1px solid ${C.border}`,
                    background: hasDiscrepancy ? alpha(C.red, 0.06) : 'transparent',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>
                      {item.productName}
                    </div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                      Qty: {item.quantity} &middot; ${item.unitPrice.toFixed(2)} &middot; {item.weight.toFixed(1)}g
                    </div>
                    {item.sku && (
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: F.mono, marginTop: 2 }}>
                        {item.sku}
                      </div>
                    )}
                  </div>

                  {/* Returned column */}
                  <div style={{
                    padding: '10px 14px',
                    borderBottom: `1px solid ${C.border}`,
                    background: hasDiscrepancy ? alpha(C.red, 0.06) : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: C.text, marginBottom: 4 }}>
                        {item.productName}
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={returned}
                        onChange={e => updateReturnedQty(item.id, e.target.value)}
                        style={{
                          width: 72, padding: '6px 8px', borderRadius: 6,
                          background: C.bg, border: `1px solid ${hasDiscrepancy ? C.red : C.border}`,
                          color: C.text, fontFamily: F.mono, fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                    {hasDiscrepancy && (
                      <span style={{
                        fontSize: 11, color: C.red, fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {returned > expected ? '+' : ''}{returned - expected}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes */}
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: C.dim, marginBottom: 6, fontWeight: 600 }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this reconciliation..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                background: C.bg, border: `1px solid ${C.border}`,
                color: C.text, fontFamily: F.body, fontSize: 13,
                resize: 'vertical', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 8, background: C.bg3,
              border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer',
              fontFamily: F.body, fontSize: 14,
            }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: '10px 24px', borderRadius: 8, background: C.accent,
                border: 'none', color: '#000', cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: F.body, fontWeight: 600, fontSize: 14,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Reconciliation'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: C.accent,
  cursor: 'pointer', textDecoration: 'underline', fontSize: 14,
  fontFamily: F.body, padding: 0,
};
