import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { FormField } from '../FormField.js';
import { SelectField } from '../SelectField.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';

const US_STATES = [
  { value: '', label: 'Select state...' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

const CONTROLLED_SUBSTANCE_DEFAULTS = [
  { value: 'signature_required', label: 'Signature Required' },
  { value: 'id_required', label: 'ID Required' },
];

export function PharmacyTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    pharmacyLicenseNumber: '',
    npi: '',
    state: '',
    requireSignature: true,
    requireDobVerification: true,
    requireDeliveryPhoto: true,
    hipaaSafeDriverDisplay: true,
    coldChainAlerts: false,
    controlledSubstanceDefault: 'signature_required',
  });

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const settings = await api.get<Partial<typeof form>>('/pharmacy/settings');
        if (settings && Object.keys(settings).length > 0) {
          setForm({
            pharmacyLicenseNumber: settings.pharmacyLicenseNumber || '',
            npi: settings.npi || '',
            state: settings.state || '',
            requireSignature: settings.requireSignature ?? true,
            requireDobVerification: settings.requireDobVerification ?? true,
            requireDeliveryPhoto: settings.requireDeliveryPhoto ?? true,
            hipaaSafeDriverDisplay: settings.hipaaSafeDriverDisplay ?? true,
            coldChainAlerts: settings.coldChainAlerts ?? false,
            controlledSubstanceDefault: settings.controlledSubstanceDefault || 'signature_required',
          });
        }
      } catch { /* first time — no settings yet */ }
      setLoading(false);
    }
    loadSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/pharmacy/settings', {
        pharmacyLicenseNumber: form.pharmacyLicenseNumber,
        npi: form.npi,
        state: form.state,
        requireSignature: form.requireSignature,
        requireDobVerification: form.requireDobVerification,
        requireDeliveryPhoto: form.requireDeliveryPhoto,
        hipaaSafeDriverDisplay: form.hipaaSafeDriverDisplay,
        coldChainAlerts: form.coldChainAlerts,
        controlledSubstanceDefault: form.controlledSubstanceDefault,
      });
      toast('Pharmacy settings saved', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {/* Settings form */}
      <div style={{
        background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
        padding: 24, maxWidth: 520, flex: '1 1 400px',
      }}>
        <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 20, color: C.text }}>
          Pharmacy Compliance Settings
        </h3>
        <form onSubmit={handleSave}>
          <FormField
            label="Pharmacy License Number"
            value={form.pharmacyLicenseNumber}
            onChange={(e) => setForm({ ...form, pharmacyLicenseNumber: e.target.value })}
            placeholder="e.g., PHY-0000001"
            required
          />

          <FormField
            label="NPI (National Provider Identifier)"
            value={form.npi}
            onChange={(e) => setForm({ ...form, npi: e.target.value })}
            placeholder="e.g., 1234567890"
          />

          <SelectField
            label="Operating State"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            options={US_STATES}
            required
          />

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 12 }}>
              Delivery Requirements
            </span>
          </div>

          {[
            { key: 'requireSignature', label: 'Require recipient signature' },
            { key: 'requireDobVerification', label: 'Require DOB verification' },
            { key: 'requireDeliveryPhoto', label: 'Require delivery photo' },
            { key: 'hipaaSafeDriverDisplay', label: 'HIPAA-safe driver display (hide patient details)' },
            { key: 'coldChainAlerts', label: 'Cold chain alerts (temperature-sensitive deliveries)' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form[key as keyof typeof form] as boolean}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: C.accent }}
              />
              <span style={{ fontSize: 14, color: C.text }}>{label}</span>
            </label>
          ))}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 12 }}>
              Controlled Substances
            </span>
          </div>

          <SelectField
            label="Controlled Substance Default"
            value={form.controlledSubstanceDefault}
            onChange={(e) => setForm({ ...form, controlledSubstanceDefault: e.target.value })}
            options={CONTROLLED_SUBSTANCE_DEFAULTS}
          />

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
