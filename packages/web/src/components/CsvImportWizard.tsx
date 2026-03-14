import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Modal } from './Modal.js';
import { C, F } from '../theme.js';

interface CsvImportWizardProps {
  open: boolean;
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => Promise<void>;
}

export function CsvImportWizard({ open, onClose, onImport }: CsvImportWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
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
        setHeaders(Object.keys(data[0]));
        setRows(data);
        setStep(2);
      },
    });
  }

  async function handleImport() {
    setImporting(true);
    try {
      await onImport(rows);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setStep(1);
    setRows([]);
    setHeaders([]);
    setError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import Orders from CSV" size="lg">
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.1)', border: `1px solid ${C.red}`,
          color: C.red, padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14,
        }}>{error}</div>
      )}

      {step === 1 && (
        <div>
          <div style={{
            border: `2px dashed ${C.muted}`, borderRadius: 12, padding: 48,
            textAlign: 'center', cursor: 'pointer',
          }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <p style={{ color: C.dim, fontSize: 14 }}>Click or drag a CSV file here</p>
            <p style={{ color: C.dim, fontSize: 12, marginTop: 8 }}>
              Expected columns: recipient_name/name, phone, email, street/address, city, state, zip, packages, priority, notes
            </p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {step === 2 && (
        <div>
          <p style={{ color: C.dim, fontSize: 14, marginBottom: 12 }}>
            Preview: {rows.length} orders found
          </p>
          <div style={{ overflowX: 'auto', maxHeight: 300, marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F.mono }}>
              <thead>
                <tr>{headers.map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: C.dim, borderBottom: `1px solid ${C.muted}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i}>{headers.map(h => (
                    <td key={h} style={{ padding: '6px 8px', color: C.text, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{row[h]}</td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && <p style={{ color: C.dim, fontSize: 12, marginTop: 8 }}>...and {rows.length - 10} more rows</p>}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setStep(1)} style={{
              padding: '8px 20px', borderRadius: 8, background: C.bg3,
              border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body,
            }}>Back</button>
            <button onClick={handleImport} disabled={importing} style={{
              padding: '8px 20px', borderRadius: 8, background: C.accent,
              border: 'none', color: '#fff', cursor: importing ? 'wait' : 'pointer',
              fontFamily: F.body, fontWeight: 600, opacity: importing ? 0.7 : 1,
            }}>{importing ? 'Importing...' : `Import ${rows.length} Orders`}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <p style={{ color: C.text, fontSize: 16, marginBottom: 20 }}>Successfully imported {rows.length} orders!</p>
          <button onClick={handleClose} style={{
            padding: '10px 24px', borderRadius: 8, background: C.accent,
            border: 'none', color: '#fff', cursor: 'pointer', fontFamily: F.body, fontWeight: 600,
          }}>Done</button>
        </div>
      )}
    </Modal>
  );
}
