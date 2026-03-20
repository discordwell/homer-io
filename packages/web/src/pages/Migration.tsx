import { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { useMigrationStore } from '../stores/migration.js';
import type { MigrationJobResponse, CreateMigrationJobInput, MigrationPlatform, MigrationPlatformInfo } from '@homer-io/shared';
import { C, F, alpha } from '../theme.js';

type WizardStep = 'select' | 'configure' | 'review' | 'progress' | 'complete';
type ImportMode = 'api' | 'csv';

const platforms: { id: MigrationPlatform; name: string; description: string; color: string }[] = [
  { id: 'tookan', name: 'Tookan', description: 'Jungleworks delivery management', color: '#FF6B35' },
  { id: 'onfleet', name: 'Onfleet', description: 'Last-mile delivery operations', color: '#6C63FF' },
  { id: 'optimoroute', name: 'OptimoRoute', description: 'Route planning & optimization', color: '#00B4D8' },
  { id: 'speedyroute', name: 'SpeedyRoute', description: 'Multi-stop route planner', color: '#2EC4B6' },
  { id: 'getswift', name: 'GetSwift', description: 'Delivery logistics platform', color: '#E71D36' },
  { id: 'circuit', name: 'Circuit', description: 'Route planning for teams', color: '#FF9F1C' },
];

function statusColor(status: string) {
  switch (status) {
    case 'completed': return C.green;
    case 'failed': return C.red;
    case 'cancelled': return C.yellow;
    case 'in_progress': return C.accent;
    case 'pending': return C.dim;
    default: return C.dim;
  }
}

export function MigrationPage() {
  const { jobs, currentJob, loading, creating, loadJobs, createJob, pollJob, cancelJob, deleteJob, validateCredentials, loadPlatforms, platformInfo } = useMigrationStore();
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedPlatform, setSelectedPlatform] = useState<MigrationPlatform | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('api');
  const [orderRows, setOrderRows] = useState<Record<string, string>[]>([]);
  const [driverRows, setDriverRows] = useState<Record<string, string>[]>([]);
  const [vehicleRows, setVehicleRows] = useState<Record<string, string>[]>([]);
  const [importOrders, setImportOrders] = useState(true);
  const [importDrivers, setImportDrivers] = useState(true);
  const [importVehicles, setImportVehicles] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message?: string; counts?: { orders?: number; drivers?: number; vehicles?: number } } | null>(null);
  const [error, setError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orderFileRef = useRef<HTMLInputElement>(null);
  const driverFileRef = useRef<HTMLInputElement>(null);
  const vehicleFileRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadJobs(); loadPlatforms(); }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Determine if selected platform supports API
  const selectedPlatformInfo = platformInfo.find(p => p.platform === selectedPlatform);
  const platformSupportsApi = selectedPlatformInfo?.supportsApi ?? false;
  const platformSupportsVehicles = selectedPlatformInfo?.supportsVehicles ?? false;

  // When platform changes, set mode accordingly
  useEffect(() => {
    if (selectedPlatform) {
      const info = platformInfo.find(p => p.platform === selectedPlatform);
      setImportMode(info?.supportsApi ? 'api' : 'csv');
      setImportVehicles(info?.supportsVehicles ?? false);
      setValidationResult(null);
      setApiKey('');
    }
  }, [selectedPlatform, platformInfo]);

  const parseFile = useCallback((file: File, setter: (rows: Record<string, string>[]) => void) => {
    setError('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setError(`Parse error: ${result.errors[0].message}`);
          return;
        }
        const data = result.data as Record<string, string>[];
        if (data.length === 0) { setError('CSV file is empty'); return; }
        setter(data);
      },
    });
  }, []);

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const updated = await pollJob(jobId);
        if (['completed', 'failed', 'cancelled'].includes(updated.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setStep('complete');
          loadJobs();
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 2000);
  }

  async function handleTestConnection() {
    if (!selectedPlatform || !apiKey) return;
    setValidating(true);
    setValidationResult(null);
    setError('');
    try {
      const result = await validateCredentials(selectedPlatform, apiKey);
      setValidationResult(result);
      if (!result.valid) {
        setError(result.message || 'Invalid credentials');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setValidating(false);
    }
  }

  async function handleCreateJob() {
    if (!selectedPlatform) return;
    setError('');
    try {
      const input: CreateMigrationJobInput = {
        sourcePlatform: selectedPlatform,
        config: {
          importOrders,
          importDrivers,
          importVehicles,
          ...(importMode === 'api' && apiKey ? { apiKey } : {}),
          ...(importMode === 'api' && dateRangeStart ? { dateRangeStart: new Date(dateRangeStart).toISOString() } : {}),
          ...(importMode === 'api' && dateRangeEnd ? { dateRangeEnd: new Date(dateRangeEnd).toISOString() } : {}),
        },
        ...(importMode === 'csv' ? {
          csvData: {
            orders: importOrders && orderRows.length > 0 ? orderRows : undefined,
            drivers: importDrivers && driverRows.length > 0 ? driverRows : undefined,
            vehicles: importVehicles && vehicleRows.length > 0 ? vehicleRows : undefined,
          },
        } : {}),
      };
      const job = await createJob(input);
      setStep('progress');
      startPolling(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create migration job');
    }
  }

  function resetWizard() {
    setStep('select');
    setSelectedPlatform(null);
    setImportMode('api');
    setOrderRows([]);
    setDriverRows([]);
    setVehicleRows([]);
    setImportOrders(true);
    setImportDrivers(true);
    setImportVehicles(false);
    setApiKey('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setValidationResult(null);
    setError('');
    setShowErrors(false);
  }

  // Review counts: from CSV rows or API validation counts
  const reviewOrderCount = importMode === 'api' ? (validationResult?.counts?.orders ?? 0) : orderRows.length;
  const reviewDriverCount = importMode === 'api' ? (validationResult?.counts?.drivers ?? 0) : driverRows.length;
  const reviewVehicleCount = importMode === 'api' ? (validationResult?.counts?.vehicles ?? 0) : vehicleRows.length;

  const progress = currentJob?.progress as {
    orders: { total: number; imported: number; failed: number };
    drivers: { total: number; imported: number; failed: number };
    vehicles: { total: number; imported: number; failed: number };
  } | undefined;

  const errorLogEntries = (currentJob?.errorLog ?? []) as Array<{ entity: string; externalId: string; error: string; timestamp: string }>;

  // Can proceed to review?
  const canReview = importMode === 'api'
    ? validationResult?.valid === true
    : ((importOrders && orderRows.length > 0) || (importDrivers && driverRows.length > 0) || (importVehicles && vehicleRows.length > 0));

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: C.bg3, borderRadius: 12, padding: 24, border: `1px solid ${C.border}`,
  };

  const btnPrimary: React.CSSProperties = {
    padding: '10px 24px', borderRadius: 8, background: C.accent,
    border: 'none', color: '#000', cursor: 'pointer', fontFamily: F.body, fontWeight: 600,
    fontSize: 14,
  };

  const btnSecondary: React.CSSProperties = {
    padding: '10px 24px', borderRadius: 8, background: C.bg3,
    border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body,
    fontSize: 14,
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.muted}`,
    background: C.bg2, color: C.text, fontFamily: F.body, fontSize: 14, width: '100%',
    boxSizing: 'border-box',
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="migration-page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontFamily: F.display, fontSize: 28, marginBottom: 8 }}>Migrate Data</h1>
      <p style={{ color: C.dim, fontSize: 14, marginBottom: 32 }}>
        Import your orders, drivers, and vehicles from another platform via API or CSV export.
      </p>

      {error && (
        <div style={{
          background: alpha(C.red, 0.1), border: `1px solid ${C.red}`,
          color: C.red, padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14,
        }}>{error}</div>
      )}

      {/* ── Step 1: Select Source ─────────────────────────────────────────── */}
      {step === 'select' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Select Source Platform</h2>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {platforms.map((p) => {
              const info = platformInfo.find(pi => pi.platform === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => { setSelectedPlatform(p.id); setStep('configure'); }}
                  style={{
                    padding: 20, borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${selectedPlatform === p.id ? C.accent : C.border}`,
                    background: selectedPlatform === p.id ? alpha(C.accent, 0.05) : C.bg2,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%', background: p.color,
                    }} />
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</span>
                    {info?.supportsApi && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: alpha(C.green, 0.15), color: C.green, fontWeight: 600 }}>API</span>
                    )}
                  </div>
                  <p style={{ color: C.dim, fontSize: 13 }}>{p.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 2: Configure ─────────────────────────────────────────────── */}
      {step === 'configure' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button onClick={() => setStep('select')} style={btnSecondary}>Back</button>
            <h2 style={{ fontSize: 18, margin: 0 }}>
              Import from {platforms.find(p => p.id === selectedPlatform)?.name}
            </h2>
          </div>

          {/* Mode toggle — only show if platform supports API */}
          {platformSupportsApi && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.muted}`, width: 'fit-content' }}>
              <button
                onClick={() => { setImportMode('api'); setValidationResult(null); }}
                style={{
                  padding: '8px 20px', border: 'none', cursor: 'pointer', fontFamily: F.body, fontSize: 13, fontWeight: 600,
                  background: importMode === 'api' ? C.accent : C.bg2,
                  color: importMode === 'api' ? '#fff' : C.dim,
                }}
              >
                API Import
              </button>
              <button
                onClick={() => { setImportMode('csv'); setValidationResult(null); }}
                style={{
                  padding: '8px 20px', border: 'none', cursor: 'pointer', fontFamily: F.body, fontSize: 13, fontWeight: 600,
                  background: importMode === 'csv' ? C.accent : C.bg2,
                  color: importMode === 'csv' ? '#fff' : C.dim,
                }}
              >
                CSV Import
              </button>
            </div>
          )}

          {/* ── API Mode Form ──────────────────────────────────────────── */}
          {importMode === 'api' && platformSupportsApi && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, display: 'block' }}>API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setValidationResult(null); }}
                  placeholder={selectedPlatformInfo?.credentialHint || 'Enter your API key'}
                  style={inputStyle}
                />
              </div>

              <div className="migration-date-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, display: 'block' }}>Date Range Start (optional)</label>
                  <input type="date" value={dateRangeStart} onChange={e => setDateRangeStart(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, display: 'block' }}>Date Range End (optional)</label>
                  <input type="date" value={dateRangeEnd} onChange={e => setDateRangeEnd(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={importOrders} onChange={e => setImportOrders(e.target.checked)} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Orders</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={importDrivers} onChange={e => setImportDrivers(e.target.checked)} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Drivers</span>
                </label>
                {platformSupportsVehicles && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={importVehicles} onChange={e => setImportVehicles(e.target.checked)} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Vehicles</span>
                  </label>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  onClick={handleTestConnection}
                  disabled={!apiKey || validating}
                  style={{
                    ...btnSecondary,
                    opacity: !apiKey || validating ? 0.5 : 1,
                    cursor: !apiKey || validating ? 'wait' : 'pointer',
                  }}
                >
                  {validating ? 'Testing...' : 'Test Connection'}
                </button>
                {validationResult?.valid && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.green, fontSize: 14 }}>
                    <span style={{ fontSize: 18 }}>&#10003;</span>
                    <span>Connected</span>
                    {validationResult.counts && (
                      <span style={{ color: C.dim, marginLeft: 8 }}>
                        {validationResult.counts.orders !== undefined && `${validationResult.counts.orders} orders`}
                        {validationResult.counts.drivers !== undefined && `, ${validationResult.counts.drivers} drivers`}
                        {validationResult.counts.vehicles !== undefined && `, ${validationResult.counts.vehicles} vehicles`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CSV Mode Form ──────────────────────────────────────────── */}
          {(importMode === 'csv' || !platformSupportsApi) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Orders CSV */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={importOrders} onChange={e => setImportOrders(e.target.checked)} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Import Orders</span>
                </label>
                {importOrders && (
                  <FileDropZone
                    label="Orders CSV"
                    hint="Columns: name, phone, email, address/street, city, state, zip, notes"
                    fileRef={orderFileRef}
                    rowCount={orderRows.length}
                    onFile={(f) => parseFile(f, setOrderRows)}
                    onClear={() => setOrderRows([])}
                  />
                )}
              </div>

              {/* Drivers CSV */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={importDrivers} onChange={e => setImportDrivers(e.target.checked)} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Import Drivers</span>
                </label>
                {importDrivers && (
                  <FileDropZone
                    label="Drivers CSV"
                    hint="Columns: name, email, phone, driver_id/external_id"
                    fileRef={driverFileRef}
                    rowCount={driverRows.length}
                    onFile={(f) => parseFile(f, setDriverRows)}
                    onClear={() => setDriverRows([])}
                  />
                )}
              </div>

              {/* Vehicles CSV */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={importVehicles} onChange={e => setImportVehicles(e.target.checked)} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Import Vehicles</span>
                </label>
                {importVehicles && (
                  <FileDropZone
                    label="Vehicles CSV"
                    hint="Columns: name, type, license_plate, vehicle_id/external_id"
                    fileRef={vehicleFileRef}
                    rowCount={vehicleRows.length}
                    onFile={(f) => parseFile(f, setVehicleRows)}
                    onClear={() => setVehicleRows([])}
                  />
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <button onClick={() => setStep('select')} style={btnSecondary}>Back</button>
            <button
              onClick={() => setStep('review')}
              disabled={!canReview}
              style={{
                ...btnPrimary,
                opacity: canReview ? 1 : 0.5,
              }}
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review ────────────────────────────────────────────────── */}
      {step === 'review' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>Review Migration</h2>

          <div style={{ marginBottom: 16, fontSize: 13, color: C.dim }}>
            Source: <strong style={{ color: C.text }}>{platforms.find(p => p.id === selectedPlatform)?.name}</strong>
            {' '}&middot;{' '}Mode: <strong style={{ color: C.text }}>{importMode === 'api' ? 'API Import' : 'CSV Import'}</strong>
          </div>

          <div className="migration-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <SummaryCard label="Orders" count={importOrders ? reviewOrderCount : 0} active={importOrders} />
            <SummaryCard label="Drivers" count={importDrivers ? reviewDriverCount : 0} active={importDrivers} />
            <SummaryCard label="Vehicles" count={importVehicles ? reviewVehicleCount : 0} active={importVehicles} />
          </div>

          {/* Preview first 10 order rows (CSV mode only) */}
          {importMode === 'csv' && importOrders && orderRows.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, color: C.dim, marginBottom: 8 }}>Order Preview (first 10 rows)</h3>
              <PreviewTable rows={orderRows.slice(0, 10)} />
              {orderRows.length > 10 && <p style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>...and {orderRows.length - 10} more</p>}
            </div>
          )}

          {importMode === 'api' && (
            <p style={{ color: C.dim, fontSize: 13, marginBottom: 20 }}>
              Records will be fetched from the {platforms.find(p => p.id === selectedPlatform)?.name} API during migration.
              {dateRangeStart && ` From ${dateRangeStart}`}{dateRangeEnd && ` to ${dateRangeEnd}`}.
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button onClick={() => setStep('configure')} style={btnSecondary}>Back</button>
            <button onClick={handleCreateJob} disabled={creating} style={{
              ...btnPrimary, opacity: creating ? 0.7 : 1, cursor: creating ? 'wait' : 'pointer',
            }}>
              {creating ? 'Starting...' : 'Start Migration'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Progress ──────────────────────────────────────────────── */}
      {step === 'progress' && currentJob && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>Migration in Progress</h2>

          {progress && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {progress.orders.total > 0 && (
                <ProgressBar label="Orders" current={progress.orders.imported + progress.orders.failed} total={progress.orders.total} failed={progress.orders.failed} />
              )}
              {progress.drivers.total > 0 && (
                <ProgressBar label="Drivers" current={progress.drivers.imported + progress.drivers.failed} total={progress.drivers.total} failed={progress.drivers.failed} />
              )}
              {progress.vehicles.total > 0 && (
                <ProgressBar label="Vehicles" current={progress.vehicles.imported + progress.vehicles.failed} total={progress.vehicles.total} failed={progress.vehicles.failed} />
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => cancelJob(currentJob.id)} style={{
              ...btnSecondary, color: C.red, borderColor: C.red,
            }}>
              Cancel Migration
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Complete ──────────────────────────────────────────────── */}
      {step === 'complete' && currentJob && (
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {currentJob.status === 'completed' ? '✅' : currentJob.status === 'cancelled' ? '⚠️' : '❌'}
            </div>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>
              Migration {currentJob.status === 'completed' ? 'Complete' : currentJob.status === 'cancelled' ? 'Cancelled' : 'Failed'}
            </h2>
          </div>

          {progress && (
            <div className="migration-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              {progress.orders.total > 0 && <ResultCard label="Orders" imported={progress.orders.imported} failed={progress.orders.failed} total={progress.orders.total} />}
              {progress.drivers.total > 0 && <ResultCard label="Drivers" imported={progress.drivers.imported} failed={progress.drivers.failed} total={progress.drivers.total} />}
              {progress.vehicles.total > 0 && <ResultCard label="Vehicles" imported={progress.vehicles.imported} failed={progress.vehicles.failed} total={progress.vehicles.total} />}
            </div>
          )}

          {errorLogEntries.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => setShowErrors(!showErrors)}
                style={{ ...btnSecondary, fontSize: 13, marginBottom: 8 }}
              >
                {showErrors ? 'Hide' : 'Show'} Error Log ({errorLogEntries.length} entries)
              </button>
              {showErrors && (
                <div style={{
                  maxHeight: 200, overflow: 'auto', background: C.bg2, borderRadius: 8,
                  padding: 12, fontSize: 12, fontFamily: F.mono,
                }}>
                  {errorLogEntries.map((e, i) => (
                    <div key={i} style={{ marginBottom: 4, color: C.red }}>
                      [{e.entity}] {e.externalId}: {e.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <a href="/dashboard/orders" style={{
              ...btnSecondary, textDecoration: 'none', display: 'inline-block',
            }}>View Orders</a>
            <button onClick={resetWizard} style={btnPrimary}>New Migration</button>
          </div>
        </div>
      )}

      {/* ── Migration History ─────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Migration History</h2>
        {loading && <p style={{ color: C.dim, fontSize: 14 }}>Loading...</p>}
        {!loading && jobs.length === 0 && (
          <p style={{ color: C.dim, fontSize: 14 }}>No migration jobs yet.</p>
        )}
        {!loading && jobs.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="migration-history-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.muted}` }}>
                  <th style={thStyle}>Platform</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Orders</th>
                  <th style={thStyle}>Drivers</th>
                  <th style={thStyle}>Vehicles</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const p = job.progress as { orders: { total: number; imported: number; failed: number }; drivers: { total: number; imported: number; failed: number }; vehicles: { total: number; imported: number; failed: number } };
                  return (
                    <tr key={job.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                          background: alpha(C.accent, 0.1), color: C.accent,
                        }}>
                          {job.sourcePlatform}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                          color: statusColor(job.status),
                        }}>
                          {job.status}
                        </span>
                      </td>
                      <td style={tdStyle}>{p?.orders ? `${p.orders.imported}/${p.orders.total}` : '-'}</td>
                      <td style={tdStyle}>{p?.drivers ? `${p.drivers.imported}/${p.drivers.total}` : '-'}</td>
                      <td style={tdStyle}>{p?.vehicles ? `${p.vehicles.imported}/${p.vehicles.total}` : '-'}</td>
                      <td style={tdStyle}>{new Date(job.createdAt).toLocaleDateString()}</td>
                      <td style={tdStyle}>
                        {['completed', 'failed', 'cancelled'].includes(job.status) && (
                          <button
                            onClick={() => deleteJob(job.id)}
                            style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontFamily: F.body }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', color: C.dim, fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: '10px 12px', color: C.text };

function FileDropZone({ label, hint, fileRef, rowCount, onFile, onClear }: {
  label: string; hint: string;
  fileRef: React.RefObject<HTMLInputElement | null>;
  rowCount: number;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div>
      {rowCount > 0 ? (
        <div style={{
          border: `1px solid ${C.green}`, borderRadius: 8, padding: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: alpha(C.green, 0.05),
        }}>
          <span style={{ color: C.green, fontSize: 14 }}>{rowCount} rows loaded</span>
          <button onClick={onClear} style={{
            background: 'none', border: 'none', color: C.dim, cursor: 'pointer',
            fontSize: 12, fontFamily: F.body,
          }}>Clear</button>
        </div>
      ) : (
        <div
          style={{
            border: `2px dashed ${C.muted}`, borderRadius: 8, padding: 32,
            textAlign: 'center', cursor: 'pointer',
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
          <p style={{ color: C.dim, fontSize: 14 }}>{label} — click or drag CSV file</p>
          <p style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>{hint}</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

function SummaryCard({ label, count, active }: { label: string; count: number; active: boolean }) {
  return (
    <div style={{
      background: C.bg2, borderRadius: 8, padding: 16, textAlign: 'center',
      border: `1px solid ${active ? C.muted : C.border}`,
      opacity: active ? 1 : 0.4,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: active ? C.accent : C.dim }}>{count}</div>
      <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function PreviewTable({ rows }: { rows: Record<string, string>[] }) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return (
    <div style={{ overflowX: 'auto', maxHeight: 250 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F.mono }}>
        <thead>
          <tr>{headers.map(h => (
            <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: C.dim, borderBottom: `1px solid ${C.muted}`, whiteSpace: 'nowrap' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{headers.map(h => (
              <td key={h} style={{ padding: '4px 8px', color: C.text, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row[h]}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressBar({ label, current, total, failed }: { label: string; current: number; total: number; failed: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
        <span>{label}</span>
        <span style={{ color: C.dim }}>{current}/{total} {failed > 0 && <span style={{ color: C.red }}>({failed} failed)</span>}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: C.bg2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct}%`,
          background: failed > 0 && current > 0 ? `linear-gradient(90deg, ${C.accent} ${100 - (failed / current * 100)}%, ${C.red} 100%)` : C.accent,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );
}

function ResultCard({ label, imported, failed, total }: { label: string; imported: number; failed: number; total: number }) {
  return (
    <div style={{ background: C.bg2, borderRadius: 8, padding: 16, textAlign: 'center', border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{imported}</div>
      <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
        of {total} imported
        {failed > 0 && <span style={{ color: C.red }}> ({failed} failed)</span>}
      </div>
    </div>
  );
}
