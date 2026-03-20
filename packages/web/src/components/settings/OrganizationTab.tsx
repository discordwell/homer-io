import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settings.js';
import { FormField, inputStyle } from '../FormField.js';
import { SelectField } from '../SelectField.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';

const timezoneOptions = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

const unitOptions = [
  { value: 'imperial', label: 'Imperial (mi, lb)' },
  { value: 'metric', label: 'Metric (km, kg)' },
];

export function OrganizationTab() {
  const { orgSettings, loading, fetchSettings, updateSettings } = useSettingsStore();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    timezone: 'America/Los_Angeles',
    units: 'imperial',
    companyName: '',
    primaryColor: '#F59E0B',
  });

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (orgSettings) {
      const branding = orgSettings.branding as Record<string, string> || {};
      setForm({
        timezone: orgSettings.timezone,
        units: orgSettings.units,
        companyName: branding.companyName || '',
        primaryColor: branding.primaryColor || '#F59E0B',
      });
    }
  }, [orgSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        timezone: form.timezone,
        units: form.units as 'imperial' | 'metric',
        branding: {
          companyName: form.companyName || undefined,
          primaryColor: form.primaryColor || undefined,
        },
      });
      toast('Settings saved', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !orgSettings) return <LoadingSpinner />;

  return (
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
      padding: 24, maxWidth: 560,
    }}>
      <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 20, color: C.text }}>
        Organization Settings
      </h3>
      <form onSubmit={handleSave}>
        <SelectField
          label="Timezone"
          value={form.timezone}
          onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          options={timezoneOptions}
          required
        />
        <SelectField
          label="Units"
          value={form.units}
          onChange={(e) => setForm({ ...form, units: e.target.value })}
          options={unitOptions}
          required
        />

        <div style={{
          borderTop: `1px solid ${C.border}`, paddingTop: 20, marginTop: 8, marginBottom: 16,
        }}>
          <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 16 }}>
            Branding
          </span>
        </div>

        <FormField
          label="Company Name"
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          placeholder="Your company name"
        />

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>
            Primary Color
          </span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              style={{
                width: 44, height: 44, border: `1px solid ${C.muted}`,
                borderRadius: 8, background: C.bg, cursor: 'pointer',
                padding: 2,
              }}
            />
            <input
              type="text"
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              style={{ ...inputStyle, width: 140 }}
              pattern="^#[0-9a-fA-F]{6}$"
              placeholder="#F59E0B"
            />
          </div>
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
  );
}
