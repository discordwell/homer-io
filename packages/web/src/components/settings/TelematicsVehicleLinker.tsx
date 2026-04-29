import { useEffect, useState } from 'react';
import { useTelematicsStore, type ExternalVehicleRow } from '../../stores/telematics.js';
import { useFleetStore } from '../../stores/fleet.js';
import { useToast } from '../Toast.js';
import { C, F, alpha, primaryBtnStyle, secondaryBtnStyle } from '../../theme.js';
import { LoadingSpinner } from '../LoadingSpinner.js';

interface Props {
  open: boolean;
  connectionId: string | null;
  onClose: () => void;
}

export function TelematicsVehicleLinker({ open, connectionId, onClose }: Props) {
  const { toast } = useToast();
  const { listVehicles, linkVehicle } = useTelematicsStore();
  const { vehicles: homerVehicles, fetchVehicles } = useFleetStore();
  const [rows, setRows] = useState<ExternalVehicleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingMap, setPendingMap] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Reset on (open, connectionId) change — adjust state during render.
  const fetchKey = open && connectionId ? connectionId : null;
  const [lastKey, setLastKey] = useState<string | null>(fetchKey);
  if (lastKey !== fetchKey) {
    setLastKey(fetchKey);
    setRows([]);
    setPendingMap({});
    setLoading(fetchKey !== null);
  }

  useEffect(() => {
    if (!fetchKey) return;
    let cancelled = false;
    Promise.all([
      listVehicles(fetchKey).then((r) => { if (!cancelled) setRows(r); }),
      fetchVehicles(1),
    ]).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey, listVehicles, fetchVehicles]);

  function effectiveSelection(row: ExternalVehicleRow): string {
    if (pendingMap[row.externalVehicleId] !== undefined) return pendingMap[row.externalVehicleId];
    if (row.mappedVehicleId) return row.mappedVehicleId;
    if (row.suggestion) return row.suggestion.vehicleId;
    return '';
  }

  function isDirty(row: ExternalVehicleRow): boolean {
    const sel = effectiveSelection(row);
    const current = row.mappedVehicleId ?? '';
    return sel !== current;
  }

  async function handleSave(row: ExternalVehicleRow) {
    if (!connectionId) return;
    setSavingId(row.externalVehicleId);
    try {
      const target = pendingMap[row.externalVehicleId] !== undefined
        ? pendingMap[row.externalVehicleId]
        : (row.suggestion?.vehicleId ?? '');
      await linkVehicle(connectionId, row.externalVehicleId, target || null);
      const reloaded = await listVehicles(connectionId);
      setRows(reloaded);
      setPendingMap(prev => {
        const next = { ...prev };
        delete next[row.externalVehicleId];
        return next;
      });
      toast('Vehicle linked', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Link failed', 'error');
    } finally {
      setSavingId(null);
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
          padding: 24, width: '100%', maxWidth: 820, maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: F.display, fontSize: 18, color: C.text, margin: 0 }}>
              Link upstream vehicles
            </h2>
            <span style={{ color: C.dim, fontSize: 13, fontFamily: F.body }}>
              Match each Samsara/Motive/Geotab vehicle to an existing Homer vehicle.
              Positions only flow through once a link is saved.
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        {loading && <LoadingSpinner />}

        {!loading && rows.length === 0 && (
          <div style={{ color: C.dim, fontFamily: F.body, padding: 16, textAlign: 'center' }}>
            No upstream vehicles have been synced yet. Check back in a minute.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: F.body }}>
            <thead>
              <tr style={{ color: C.dim, textAlign: 'left' }}>
                <th style={{ padding: '8px 4px', fontWeight: 500 }}>Upstream vehicle</th>
                <th style={{ padding: '8px 4px', fontWeight: 500 }}>Plate / VIN</th>
                <th style={{ padding: '8px 4px', fontWeight: 500 }}>Link to Homer vehicle</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const selection = effectiveSelection(row);
                const dirty = isDirty(row);
                return (
                  <tr key={row.externalVehicleId} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 4px', color: C.text }}>
                      <div style={{ fontWeight: 600 }}>{row.name ?? row.externalVehicleId}</div>
                      <div style={{ color: C.dim, fontSize: 11 }}>
                        {[row.year, row.make, row.model].filter(Boolean).join(' ')}
                      </div>
                    </td>
                    <td style={{ padding: '10px 4px', color: C.dim, fontFamily: F.mono, fontSize: 12 }}>
                      {row.plate ?? row.vin ?? '—'}
                    </td>
                    <td style={{ padding: '10px 4px' }}>
                      <select
                        value={selection}
                        onChange={(e) => setPendingMap(prev => ({ ...prev, [row.externalVehicleId]: e.target.value }))}
                        style={{
                          width: '100%', background: C.bg3, color: C.text, border: `1px solid ${C.border}`,
                          padding: '6px 8px', borderRadius: 6, fontFamily: F.body, fontSize: 13,
                        }}
                      >
                        <option value="">— Not linked —</option>
                        {homerVehicles.map(hv => (
                          <option key={hv.id} value={hv.id}>
                            {hv.name} {hv.licensePlate ? `· ${hv.licensePlate}` : ''}
                          </option>
                        ))}
                      </select>
                      {row.suggestion && !row.mappedVehicleId && (
                        <div style={{ marginTop: 4, color: C.green, fontSize: 11 }}>
                          Suggested: {row.suggestion.vehicleName} (plate match)
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleSave(row)}
                        disabled={!dirty || savingId === row.externalVehicleId}
                        style={{
                          ...(dirty ? primaryBtnStyle : secondaryBtnStyle),
                          opacity: (!dirty || savingId === row.externalVehicleId) ? 0.4 : 1,
                          fontSize: 12, padding: '6px 10px',
                        }}
                      >
                        {savingId === row.externalVehicleId ? '…' : dirty ? 'Save' : 'Saved'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && rows.length > 0 && (
          <div style={{ marginTop: 16, padding: 10, borderRadius: 8, background: alpha(C.accent, 0.05), border: `1px solid ${alpha(C.accent, 0.15)}`, color: C.dim, fontSize: 12 }}>
            Tip: vehicles with matching license plates are auto-suggested. Click Save to accept or pick a different vehicle from the dropdown.
          </div>
        )}
      </div>
    </div>
  );
}
