import { useState } from 'react';
import { Modal } from '../Modal.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { useIntegrationsStore } from '../../stores/integrations.js';
import { C, F, alpha } from '../../theme.js';
import type { PlatformInfo } from '@homer-io/shared';

interface IntegrationConnectFormProps {
  open: boolean;
  onClose: () => void;
  platform: PlatformInfo | null;
}

export function IntegrationConnectForm({ open, onClose, platform }: IntegrationConnectFormProps) {
  const { toast } = useToast();
  const { createConnection } = useIntegrationsStore();

  const [storeUrl, setStoreUrl] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [autoImport, setAutoImport] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setStoreUrl('');
    setCredentials({});
    setAutoImport(true);
    setTesting(false);
    setTestResult(null);
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleTestConnection() {
    if (!platform) return;
    setTesting(true);
    setTestResult(null);
    try {
      // Use the platform connector to validate via the create flow's validation
      // We'll do a dry-run by calling the test endpoint conceptually,
      // but since there's no connection yet, we create-then-test by just trying to create
      // For now, signal success if the URL and creds look valid
      const hasAllCreds = platform.requiredCredentials.every(c => credentials[c.key]?.trim());
      if (!storeUrl.trim() || !hasAllCreds) {
        toast('Please fill in all required fields', 'error');
        setTestResult(false);
        return;
      }
      // We can't test without creating, so we just validate client-side
      // The server validates on create
      setTestResult(true);
      toast('Fields look valid — connection will be verified on save', 'info');
    } catch {
      setTestResult(false);
      toast('Connection test failed', 'error');
    } finally {
      setTesting(false);
    }
  }

  async function handleConnect() {
    if (!platform) return;
    const hasAllCreds = platform.requiredCredentials.every(c => credentials[c.key]?.trim());
    if (!storeUrl.trim() || !hasAllCreds) {
      toast('Please fill in all required fields', 'error');
      return;
    }
    setSaving(true);
    try {
      await createConnection({
        platform: platform.platform,
        storeUrl: storeUrl.trim(),
        credentials,
        autoImport,
      });
      toast(`Connected to ${platform.name}`, 'success');
      handleClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to connect', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!platform) return null;

  return (
    <Modal open={open} onClose={handleClose} title={`Connect ${platform.name}`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Store URL */}
        <div>
          <label style={labelStyle}>Store URL</label>
          <input
            type="url"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            placeholder={platform.platform === 'shopify' ? 'mystore.myshopify.com' : 'https://mystore.com'}
            style={inputStyle}
          />
        </div>

        {/* Dynamic credential fields */}
        {platform.requiredCredentials.map((cred) => (
          <div key={cred.key}>
            <label style={labelStyle}>{cred.label}</label>
            <input
              type={cred.type === 'password' ? 'password' : 'text'}
              value={credentials[cred.key] || ''}
              onChange={(e) => setCredentials(prev => ({ ...prev, [cred.key]: e.target.value }))}
              placeholder={cred.placeholder || ''}
              style={inputStyle}
            />
          </div>
        ))}

        {/* Auto-import toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setAutoImport(!autoImport)}
            style={{
              width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
              background: autoImport ? C.accent : C.muted,
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3,
              left: autoImport ? 21 : 3, transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ color: C.text, fontSize: 14, fontFamily: F.body }}>
            Auto-import new orders
          </span>
        </div>

        {/* Test result indicator */}
        {testResult !== null && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 13, fontFamily: F.body,
            background: testResult ? alpha(C.green, 0.08) : alpha(C.red, 0.08),
            color: testResult ? C.green : C.red,
            border: `1px solid ${testResult ? alpha(C.green, 0.19) : alpha(C.red, 0.19)}`,
          }}>
            {testResult ? 'Fields validated — credentials will be verified on save' : 'Please check your inputs'}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={handleClose} style={secondaryBtnStyle}>
            Cancel
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            style={{ ...secondaryBtnStyle, opacity: testing ? 0.5 : 1 }}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={handleConnect}
            disabled={saving}
            style={{ ...primaryBtnStyle, opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: C.dim, fontSize: 13, fontFamily: F.body,
  marginBottom: 6, fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  background: C.bg3, border: `1px solid ${C.muted}`, color: C.text,
  fontFamily: F.body, fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.accent,
  border: 'none', color: '#000', cursor: 'pointer', fontFamily: F.body, fontWeight: 600, fontSize: 14,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body, fontSize: 14,
};
