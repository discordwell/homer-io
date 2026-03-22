import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { FormField } from '../FormField.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';

interface RestaurantSettings {
  defaultDeliveryWindowMinutes: number;
  speedPriority: boolean;
  defaultOrderBatchSize: number;
}

export function RestaurantTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    defaultDeliveryWindowMinutes: '30',
    speedPriority: false,
    defaultOrderBatchSize: '5',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const settings = await api.get<Partial<RestaurantSettings>>('/restaurant/settings');
      if (settings && Object.keys(settings).length > 0) {
        setForm({
          defaultDeliveryWindowMinutes: String(settings.defaultDeliveryWindowMinutes ?? 30),
          speedPriority: settings.speedPriority ?? false,
          defaultOrderBatchSize: String(settings.defaultOrderBatchSize ?? 5),
        });
      }
    } catch { /* first time -- no settings yet */ }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/restaurant/settings', {
        defaultDeliveryWindowMinutes: Number(form.defaultDeliveryWindowMinutes) || 30,
        speedPriority: form.speedPriority,
        defaultOrderBatchSize: Number(form.defaultOrderBatchSize) || 5,
      });
      toast('Restaurant settings saved', 'success');
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
          Restaurant Delivery Settings
        </h3>
        <form onSubmit={handleSave}>
          <FormField
            label="Default Delivery Window (minutes)"
            value={form.defaultDeliveryWindowMinutes}
            onChange={(e) => setForm({ ...form, defaultDeliveryWindowMinutes: e.target.value })}
            placeholder="30"
            type="number"
            min={5}
          />

          <FormField
            label="Default Order Batch Size"
            value={form.defaultOrderBatchSize}
            onChange={(e) => setForm({ ...form, defaultOrderBatchSize: e.target.value })}
            placeholder="5"
            type="number"
            min={1}
          />

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 12 }}>
              Routing Preferences
            </span>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.speedPriority}
              onChange={(e) => setForm({ ...form, speedPriority: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: C.accent }}
            />
            <span style={{ fontSize: 14, color: C.text }}>Optimize for fastest delivery (speed priority)</span>
          </label>
          <span style={{ fontSize: 11, color: C.muted, display: 'block', marginTop: 4, marginBottom: 16 }}>
            When enabled, routing prioritizes delivery speed over fuel efficiency.
          </span>

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
