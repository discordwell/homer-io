import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settings.js';
import { useOnboardingStore } from '../../stores/onboarding.js';
import { FormField, inputStyle } from '../FormField.js';
import { SelectField } from '../SelectField.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';
import { FEATURE_DEFINITIONS, type FeatureKey } from '@homer-io/shared';

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

const industryOptions = [
  { value: '', label: 'Select industry...' },
  { value: 'courier', label: 'Courier & Parcels' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'florist', label: 'Florist' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'cannabis', label: 'Cannabis' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'other', label: 'Other' },
];

export function OrganizationTab() {
  const { orgSettings, loading, fetchSettings, updateSettings } = useSettingsStore();
  const { loadSampleData, sampleDataLoading } = useOnboardingStore();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    timezone: 'America/Los_Angeles',
    units: 'imperial',
    industry: '',
    companyName: '',
    primaryColor: '#F59E0B',
  });

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync form from orgSettings whenever it (re)loads — adjust state during render.
  const [seenSettings, setSeenSettings] = useState(orgSettings);
  if (seenSettings !== orgSettings && orgSettings) {
    setSeenSettings(orgSettings);
    const branding = orgSettings.branding as Record<string, string> || {};
    setForm({
      timezone: orgSettings.timezone,
      units: orgSettings.units,
      industry: orgSettings.industry || '',
      companyName: branding.companyName || '',
      primaryColor: branding.primaryColor || '#F59E0B',
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        timezone: form.timezone,
        units: form.units as 'imperial' | 'metric',
        ...(form.industry ? { industry: form.industry as 'courier' | 'restaurant' | 'florist' | 'pharmacy' | 'cannabis' | 'grocery' | 'furniture' | 'other' } : {}),
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

  const industryDirty = form.industry !== (orgSettings?.industry || '');

  if (loading && !orgSettings) return <LoadingSpinner />;

  return (
    <>
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

        <SelectField
          label="Industry"
          value={form.industry}
          onChange={(e) => setForm({ ...form, industry: e.target.value })}
          options={industryOptions}
        />

        <div style={{
          padding: '12px 14px', borderRadius: 8, background: C.bg3,
          marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: 13, color: C.dim, display: 'block' }}>Sample Data</span>
            <span style={{ fontSize: 12, color: C.muted }}>
              Load ~20 sample orders for {form.industry ? industryOptions.find(o => o.value === form.industry)?.label || form.industry : 'your industry'}
            </span>
          </div>
          <button
            type="button"
            disabled={sampleDataLoading || !form.industry || industryDirty}
            onClick={async () => {
              if (!confirm('This will add ~20 sample orders to your account. Continue?')) return;
              try {
                const result = await loadSampleData();
                toast(`${result.ordersCreated} sample orders created`, 'success');
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Failed to load sample data', 'error');
              }
            }}
            style={{
              padding: '6px 14px', borderRadius: 6,
              background: 'transparent', border: `1px solid ${C.muted}`,
              color: C.dim, cursor: sampleDataLoading || !form.industry || industryDirty ? 'not-allowed' : 'pointer',
              fontFamily: F.body, fontSize: 12, fontWeight: 500,
              opacity: sampleDataLoading || !form.industry || industryDirty ? 0.5 : 1,
            }}
          >
            {sampleDataLoading ? 'Loading...' : industryDirty ? 'Save settings first' : 'Load Sample Data'}
          </button>
        </div>

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

    {/* Feature Toggles */}
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
      padding: 24, maxWidth: 560, marginTop: 24,
    }}>
      <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 4, color: C.text }}>
        Enabled Features
      </h3>
      <p style={{ color: C.dim, fontSize: 13, marginBottom: 16 }}>
        Features are auto-enabled by your industry. Toggle additional features from other industries.
      </p>
      {(['compliance', 'operations', 'customer_experience'] as const).map(cat => {
        const catFeatures = FEATURE_DEFINITIONS.filter(f => f.category === cat);
        const catLabel = cat === 'compliance' ? 'Compliance' : cat === 'operations' ? 'Operations' : 'Customer Experience';
        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {catLabel}
            </span>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {catFeatures.map(feat => {
                const currentFeatures = orgSettings?.enabledFeatures ?? [];
                const isEnabled = currentFeatures.includes(feat.key);
                return (
                  <label key={feat.key} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
                    padding: '6px 8px', borderRadius: 6,
                    background: isEnabled ? 'transparent' : 'transparent',
                  }}>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={async (e) => {
                        const updated = e.target.checked
                          ? [...currentFeatures, feat.key]
                          : currentFeatures.filter((f: string) => f !== feat.key);
                        try {
                          await updateSettings({ enabledFeatures: updated });
                          toast(`${feat.label} ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
                        } catch {
                          toast('Failed to update feature', 'error');
                        }
                      }}
                      style={{ width: 16, height: 16, accentColor: C.accent, marginTop: 2, flexShrink: 0 }}
                    />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{feat.label}</span>
                      <span style={{ fontSize: 12, color: C.dim, display: 'block', marginTop: 1 }}>{feat.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
