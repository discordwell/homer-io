import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';
import { inputStyle } from '../FormField.js';

interface FloristSettings {
  autoRequirePhoto: boolean;
  defaultGiftDelivery: boolean;
  defaultGiftMessage: string;
  defaultDeliveryInstructions: string;
}

export function FloristTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FloristSettings>({
    autoRequirePhoto: true,
    defaultGiftDelivery: false,
    defaultGiftMessage: '',
    defaultDeliveryInstructions: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const settings = await api.get<FloristSettings>('/florist/settings');
      if (settings) {
        setForm({
          autoRequirePhoto: settings.autoRequirePhoto ?? true,
          defaultGiftDelivery: settings.defaultGiftDelivery ?? false,
          defaultGiftMessage: settings.defaultGiftMessage ?? '',
          defaultDeliveryInstructions: settings.defaultDeliveryInstructions ?? '',
        });
      }
    } catch { /* first time — no settings yet */ }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/florist/settings', {
        autoRequirePhoto: form.autoRequirePhoto,
        defaultGiftDelivery: form.defaultGiftDelivery,
        defaultGiftMessage: form.defaultGiftMessage,
        defaultDeliveryInstructions: form.defaultDeliveryInstructions,
      });
      toast('Florist settings saved', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <div style={{
        background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
        padding: 24, maxWidth: 520, flex: '1 1 400px',
      }}>
        <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 20, color: C.text }}>
          Florist Delivery Settings
        </h3>
        <form onSubmit={handleSave}>
          <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 16, marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 12 }}>
              Delivery Defaults
            </span>
          </div>

          {[
            { key: 'autoRequirePhoto' as const, label: 'Auto-require delivery photo' },
            { key: 'defaultGiftDelivery' as const, label: 'All orders are gift deliveries by default' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: C.accent }}
              />
              <span style={{ fontSize: 14, color: C.text }}>{label}</span>
            </label>
          ))}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 12 }}>
              Gift &amp; Delivery Messages
            </span>
          </div>

          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>
              Default Gift Message
            </span>
            <textarea
              value={form.defaultGiftMessage}
              onChange={(e) => setForm({ ...form, defaultGiftMessage: e.target.value })}
              placeholder="Optional default message for gift card"
              style={{
                ...inputStyle, width: '100%', minHeight: 80, resize: 'vertical',
                fontFamily: F.body, fontSize: 14,
              }}
            />
            <span style={{ fontSize: 11, color: C.muted, display: 'block', marginTop: 4 }}>
              Pre-filled on new gift orders. Staff can override per order.
            </span>
          </label>

          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>
              Default Delivery Instructions
            </span>
            <textarea
              value={form.defaultDeliveryInstructions}
              onChange={(e) => setForm({ ...form, defaultDeliveryInstructions: e.target.value })}
              placeholder="e.g., Ring doorbell, leave at door if not home"
              style={{
                ...inputStyle, width: '100%', minHeight: 80, resize: 'vertical',
                fontFamily: F.body, fontSize: 14,
              }}
            />
            <span style={{ fontSize: 11, color: C.muted, display: 'block', marginTop: 4 }}>
              Applied to all new orders automatically. Drivers see this in their delivery notes.
            </span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="submit" disabled={saving} style={{
              padding: '10px 24px', borderRadius: 8, background: C.accent,
              border: 'none', color: '#000', cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: F.body, fontWeight: 600, fontSize: 14,
              opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
