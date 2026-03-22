import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { FormField } from '../FormField.js';
import { SelectField } from '../SelectField.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';

interface GrocerySettings {
  defaultSubstitutionPolicy: string;
  temperatureMonitoring: boolean;
  defaultTemperatureZones: string[];
  deliveryBatchWindowMinutes: number;
}

const SUBSTITUTION_OPTIONS = [
  { value: 'allow_all', label: 'Allow All Substitutions' },
  { value: 'ask_first', label: 'Ask Customer First' },
  { value: 'no_substitutions', label: 'No Substitutions' },
];

const TEMPERATURE_ZONES = [
  { key: 'frozen', label: 'Frozen' },
  { key: 'refrigerated', label: 'Refrigerated' },
  { key: 'ambient', label: 'Ambient' },
];

export function GroceryTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    defaultSubstitutionPolicy: 'ask_first',
    temperatureMonitoring: false,
    defaultTemperatureZones: ['ambient'] as string[],
    deliveryBatchWindowMinutes: '30',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const settings = await api.get<Partial<GrocerySettings>>('/grocery/settings');
      if (settings && Object.keys(settings).length > 0) {
        setForm({
          defaultSubstitutionPolicy: settings.defaultSubstitutionPolicy ?? 'ask_first',
          temperatureMonitoring: settings.temperatureMonitoring ?? false,
          defaultTemperatureZones: settings.defaultTemperatureZones ?? ['ambient'],
          deliveryBatchWindowMinutes: String(settings.deliveryBatchWindowMinutes ?? 30),
        });
      }
    } catch { /* first time -- no settings yet */ }
    setLoading(false);
  }

  function toggleZone(zone: string) {
    setForm(prev => {
      const zones = prev.defaultTemperatureZones.includes(zone)
        ? prev.defaultTemperatureZones.filter(z => z !== zone)
        : [...prev.defaultTemperatureZones, zone];
      return { ...prev, defaultTemperatureZones: zones };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/grocery/settings', {
        defaultSubstitutionPolicy: form.defaultSubstitutionPolicy,
        temperatureMonitoring: form.temperatureMonitoring,
        defaultTemperatureZones: form.defaultTemperatureZones,
        deliveryBatchWindowMinutes: Number(form.deliveryBatchWindowMinutes) || 30,
      });
      toast('Grocery settings saved', 'success');
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
          Grocery Delivery Settings
        </h3>
        <form onSubmit={handleSave}>
          <SelectField
            label="Default Substitution Policy"
            value={form.defaultSubstitutionPolicy}
            onChange={(e) => setForm({ ...form, defaultSubstitutionPolicy: e.target.value })}
            options={SUBSTITUTION_OPTIONS}
          />

          <FormField
            label="Delivery Batch Window (minutes)"
            value={form.deliveryBatchWindowMinutes}
            onChange={(e) => setForm({ ...form, deliveryBatchWindowMinutes: e.target.value })}
            placeholder="30"
            type="number"
            min={5}
          />

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 12 }}>
              Temperature Management
            </span>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.temperatureMonitoring}
              onChange={(e) => setForm({ ...form, temperatureMonitoring: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: C.accent }}
            />
            <span style={{ fontSize: 14, color: C.text }}>Enable temperature monitoring</span>
          </label>
          <span style={{ fontSize: 11, color: C.muted, display: 'block', marginTop: 4, marginBottom: 16 }}>
            Alerts drivers when temperature-sensitive items are in transit too long.
          </span>

          <div style={{ marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 8 }}>
              Default Temperature Zones
            </span>
            {TEMPERATURE_ZONES.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.defaultTemperatureZones.includes(key)}
                  onChange={() => toggleZone(key)}
                  style={{ width: 18, height: 18, accentColor: C.accent }}
                />
                <span style={{ fontSize: 14, color: C.text }}>{label}</span>
              </label>
            ))}
            <span style={{ fontSize: 11, color: C.muted, display: 'block', marginTop: 4 }}>
              Selected zones are pre-checked on new orders. Drivers see zone indicators.
            </span>
          </div>

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
