import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F, alpha, primaryBtnStyle, secondaryBtnStyle } from '../../theme.js';

interface ExportRequest {
  id: string;
  status: string;
  fileUrl: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface DeletionRequest {
  id: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const RETENTION_POLICIES = [
  { name: 'Location History', days: 90 },
  { name: 'Activity Log', days: 365 },
  { name: 'Customer Notification Log', days: 180 },
  { name: 'Webhook Deliveries', days: 90 },
];

const statusColors: Record<string, string> = {
  queued: C.dim,
  processing: C.accent,
  completed: C.green,
  failed: C.red,
  pending: C.yellow,
  confirmed: C.orange,
};

export function PrivacyTab() {
  const { toast } = useToast();
  const [exports, setExports] = useState<ExportRequest[]>([]);
  const [deletions, setDeletions] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function fetchData() {
    try {
      const [exportRes, deletionRes] = await Promise.all([
        api.get<{ items: ExportRequest[] }>('/gdpr/exports'),
        api.get<{ items: DeletionRequest[] }>('/gdpr/deletion-requests'),
      ]);
      setExports(exportRes.items);
      setDeletions(deletionRes.items);
    } catch {
      // empty state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();

    // Check for deletion confirmation token in URL
    const params = new URLSearchParams(window.location.search);
    const confirmToken = params.get('confirm-delete');
    if (confirmToken) {
      api.post('/gdpr/delete-account/confirm', { token: confirmToken })
        .then(() => {
          toast('Account deletion confirmed', 'success');
          fetchData();
        })
        .catch(() => toast('Invalid or expired confirmation link', 'error'));
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('confirm-delete');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      await api.post('/gdpr/export');
      toast('Data export requested. You will be notified when it is ready.', 'success');
      await fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to request export', 'error');
    }
    setExporting(false);
  }

  async function handleDeleteRequest() {
    if (confirmPhrase !== 'DELETE MY ACCOUNT') {
      toast('Please type "DELETE MY ACCOUNT" exactly to confirm', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/gdpr/delete-account', { confirmPhrase });
      toast('Deletion request submitted. Check your email to confirm.', 'success');
      setShowDeleteConfirm(false);
      setConfirmPhrase('');
      await fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to request deletion', 'error');
    }
    setSubmitting(false);
  }

  async function handleCancelDeletion() {
    try {
      await api.delete('/gdpr/delete-account');
      toast('Deletion request cancelled', 'success');
      await fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to cancel', 'error');
    }
  }

  if (loading) return <LoadingSpinner />;

  const activeDeletion = deletions.find(d => d.status === 'pending' || d.status === 'confirmed');

  return (
    <div>
      {/* Data Export Section */}
      <div style={{
        background: C.bg2,
        borderRadius: 12,
        border: `1px solid ${C.muted}`,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: F.display, fontSize: 18, color: C.text, margin: '0 0 4px' }}>
              Data Export
            </h3>
            <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>
              Download a copy of all your organization's data in JSON format.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              ...primaryBtnStyle,
              opacity: exporting ? 0.6 : 1,
            }}
          >
            {exporting ? 'Requesting...' : 'Request Export'}
          </button>
        </div>

        {exports.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Status', 'Download'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exports.map(exp => (
                <tr key={exp.id}>
                  <td style={cellStyle}>
                    {new Date(exp.createdAt).toLocaleDateString()}
                  </td>
                  <td style={cellStyle}>
                    <span style={{
                      color: statusColors[exp.status] || C.dim,
                      fontWeight: 600,
                      fontSize: 13,
                    }}>
                      {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    {exp.status === 'completed' && exp.fileUrl ? (
                      <a
                        href={exp.fileUrl}
                        download={`homer-export-${exp.id}.json`}
                        style={{ color: C.accent, fontSize: 13, textDecoration: 'none', fontFamily: F.body }}
                      >
                        Download
                      </a>
                    ) : exp.status === 'processing' || exp.status === 'queued' ? (
                      <span style={{ color: C.dim, fontSize: 13 }}>Processing...</span>
                    ) : (
                      <span style={{ color: C.dim, fontSize: 13 }}>--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Retention Policies Section */}
      <div style={{
        background: C.bg2,
        borderRadius: 12,
        border: `1px solid ${C.muted}`,
        padding: 24,
        marginBottom: 24,
      }}>
        <h3 style={{ fontFamily: F.display, fontSize: 18, color: C.text, margin: '0 0 4px' }}>
          Data Retention
        </h3>
        <p style={{ color: C.dim, fontSize: 13, margin: '0 0 16px' }}>
          Data older than the retention period is automatically purged.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {RETENTION_POLICIES.map(p => (
            <div key={p.name} style={{
              background: C.bg3,
              borderRadius: 8,
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ color: C.text, fontSize: 13, fontFamily: F.body }}>
                {p.name}
              </span>
              <span style={{ color: C.dim, fontSize: 13, fontFamily: F.mono }}>
                {p.days} days
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Account Deletion Section */}
      <div style={{
        background: C.bg2,
        borderRadius: 12,
        border: `1px solid ${alpha(C.red, 0.25)}`,
        padding: 24,
      }}>
        <h3 style={{ fontFamily: F.display, fontSize: 18, color: C.red, margin: '0 0 4px' }}>
          Delete Account
        </h3>
        <p style={{ color: C.dim, fontSize: 13, margin: '0 0 16px' }}>
          Permanently delete your organization and all associated data. This action is irreversible.
          There is a 30-day grace period before deletion is processed.
        </p>

        {activeDeletion ? (
          <div style={{
            background: alpha(C.red, 0.06),
            borderRadius: 8,
            padding: 16,
            border: `1px solid ${alpha(C.red, 0.19)}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: C.red, fontWeight: 600, fontSize: 14 }}>
                  Deletion {activeDeletion.status === 'confirmed' ? 'Confirmed' : 'Pending Confirmation'}
                </span>
                {activeDeletion.scheduledAt && (
                  <p style={{ color: C.dim, fontSize: 13, margin: '4px 0 0' }}>
                    Scheduled for: {new Date(activeDeletion.scheduledAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={handleCancelDeletion}
                style={secondaryBtnStyle}
              >
                Cancel Deletion
              </button>
            </div>
          </div>
        ) : showDeleteConfirm ? (
          <div style={{
            background: alpha(C.red, 0.06),
            borderRadius: 8,
            padding: 16,
            border: `1px solid ${alpha(C.red, 0.19)}`,
          }}>
            <p style={{ color: C.text, fontSize: 14, margin: '0 0 12px' }}>
              Type <strong style={{ color: C.red }}>DELETE MY ACCOUNT</strong> to confirm:
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${C.muted}`,
                  background: C.bg,
                  color: C.text,
                  fontFamily: F.body,
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleDeleteRequest}
                disabled={submitting || confirmPhrase !== 'DELETE MY ACCOUNT'}
                style={{
                  ...dangerBtnStyle,
                  opacity: submitting || confirmPhrase !== 'DELETE MY ACCOUNT' ? 0.5 : 1,
                }}
              >
                {submitting ? 'Submitting...' : 'Confirm'}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setConfirmPhrase(''); }}
                style={secondaryBtnStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={dangerBtnStyle}
          >
            Request Account Deletion
          </button>
        )}
      </div>
    </div>
  );
}

const dangerBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: C.red,
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: F.body,
  fontWeight: 600,
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  color: C.dim,
  fontSize: 12,
  fontFamily: F.body,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: `1px solid ${C.border}`,
};

const cellStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: F.body,
  color: C.text,
  borderBottom: `1px solid ${C.border}`,
};
