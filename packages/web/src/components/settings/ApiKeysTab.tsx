import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settings.js';
import { DataTable, type Column } from '../DataTable.js';
import { Badge } from '../Badge.js';
import { Modal } from '../Modal.js';
import { FormField } from '../FormField.js';
import { ConfirmDialog } from '../ConfirmDialog.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';

const availableScopes = [
  { value: 'orders:read', label: 'Orders (Read)' },
  { value: 'orders:write', label: 'Orders (Write)' },
  { value: 'fleet:read', label: 'Fleet (Read)' },
  { value: 'fleet:write', label: 'Fleet (Write)' },
  { value: 'routes:read', label: 'Routes (Read)' },
  { value: 'routes:write', label: 'Routes (Write)' },
  { value: 'tracking:read', label: 'Tracking (Read)' },
  { value: 'webhooks:manage', label: 'Webhooks (Manage)' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function ApiKeysTab() {
  const { apiKeys, loading, fetchApiKeys, createApiKey, revokeApiKey } = useSettingsStore();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const columns: Column<(typeof apiKeys)[0]>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'keyPrefix', header: 'Key',
      render: (k) => (
        <span style={{ fontFamily: F.mono, fontSize: 13, color: C.dim }}>{k.keyPrefix}...</span>
      ),
    },
    {
      key: 'scopes', header: 'Scopes',
      render: (k) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(k.scopes as string[]).slice(0, 3).map(s => (
            <Badge key={s} color="blue">{s}</Badge>
          ))}
          {(k.scopes as string[]).length > 3 && (
            <Badge color="dim">+{(k.scopes as string[]).length - 3}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'lastUsedAt', header: 'Last Used',
      render: (k) => (
        <span style={{ color: C.dim, fontSize: 13 }}>{k.lastUsedAt ? timeAgo(k.lastUsedAt) : 'Never'}</span>
      ),
    },
    {
      key: 'createdAt', header: 'Created',
      render: (k) => (
        <span style={{ color: C.dim, fontSize: 13 }}>{timeAgo(k.createdAt)}</span>
      ),
    },
    {
      key: 'actions', header: '', width: 80,
      render: (k) => (
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteId(k.id); }}
          style={{ ...actionBtnStyle, color: C.red }}
        >
          Revoke
        </button>
      ),
    },
  ];

  function toggleScope(scope: string) {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope],
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedScopes.length === 0) {
      toast('Select at least one scope', 'error');
      return;
    }
    try {
      const result = await createApiKey({ name, scopes: selectedScopes });
      setCreateOpen(false);
      setName('');
      setSelectedScopes([]);
      setRevealedKey(result.key);
      toast('API key created', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create API key', 'error');
    }
  }

  async function handleRevoke() {
    if (!deleteId) return;
    try {
      await revokeApiKey(deleteId);
      toast('API key revoked', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to revoke', 'error');
    }
    setDeleteId(null);
  }

  if (loading && apiKeys.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: C.dim, fontSize: 14 }}>
          {apiKeys.length} API key{apiKeys.length !== 1 ? 's' : ''}
        </span>
        <button onClick={() => setCreateOpen(true)} style={primaryBtnStyle}>
          + Create API Key
        </button>
      </div>

      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <DataTable columns={columns} data={apiKeys} />
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create API Key">
        <form onSubmit={handleCreate}>
          <FormField
            label="Key Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Shopify Integration"
            required
          />
          <div style={{ marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 10 }}>
              Scopes *
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {availableScopes.map(scope => (
                <label
                  key={scope.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8,
                    background: selectedScopes.includes(scope.value) ? `${C.accent}15` : C.bg,
                    border: `1px solid ${selectedScopes.includes(scope.value) ? C.accent : C.muted}`,
                    cursor: 'pointer', fontSize: 13, color: C.text,
                    fontFamily: F.body, transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    style={{ accentColor: C.accent }}
                  />
                  {scope.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setCreateOpen(false)} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" style={primaryBtnStyle}>Create Key</button>
          </div>
        </form>
      </Modal>

      {/* Revealed Key Modal */}
      <Modal
        open={!!revealedKey}
        onClose={() => setRevealedKey(null)}
        title="API Key Created"
        size="md"
      >
        <div style={{
          background: `${C.yellow}10`, border: `1px solid ${C.yellow}40`,
          borderRadius: 8, padding: 12, marginBottom: 16,
        }}>
          <p style={{ color: C.yellow, fontSize: 13, margin: 0 }}>
            This key will only be shown once. Copy it now and store it securely.
          </p>
        </div>
        <div style={{
          background: C.bg, borderRadius: 8, padding: 16,
          border: `1px solid ${C.muted}`, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{
              color: C.text, fontFamily: F.mono, fontSize: 13,
              wordBreak: 'break-all', flex: 1,
            }}>
              {revealedKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(revealedKey || '');
                toast('API key copied to clipboard', 'info');
              }}
              style={{
                background: C.bg3, border: `1px solid ${C.muted}`, color: C.accent,
                padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                fontSize: 13, fontFamily: F.body, fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Copy
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setRevealedKey(null)} style={primaryBtnStyle}>Done</button>
        </div>
      </Modal>

      {/* Revoke Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleRevoke}
        title="Revoke API Key"
        message="Are you sure you want to revoke this API key? Any integrations using it will stop working immediately."
        confirmLabel="Revoke"
        variant="danger"
      />
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.accent,
  border: 'none', color: '#fff', cursor: 'pointer', fontFamily: F.body, fontWeight: 600, fontSize: 14,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body,
};

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: C.accent, cursor: 'pointer',
  fontSize: 13, fontFamily: F.body, padding: '2px 4px',
};
