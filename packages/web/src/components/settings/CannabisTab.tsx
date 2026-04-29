import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { FormField, inputStyle } from '../FormField.js';
import { SelectField } from '../SelectField.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';
import type { CannabisSettings } from '@homer-io/shared';
import { KitManagement } from '../cannabis/KitManagement.js';

const US_STATES = [
  { value: '', label: 'Select state...' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'ME', label: 'Maine' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MO', label: 'Missouri' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'OR', label: 'Oregon' },
  { value: 'RI', label: 'Rhode Island' },
  // Medical-only delivery states
  { value: 'AZ', label: 'Arizona (Medical)' },
  { value: 'AR', label: 'Arkansas (Medical)' },
  { value: 'DE', label: 'Delaware (Medical)' },
  { value: 'DC', label: 'District of Columbia (Medical)' },
  { value: 'FL', label: 'Florida (Medical)' },
  { value: 'KY', label: 'Kentucky (Medical)' },
  { value: 'LA', label: 'Louisiana (Medical)' },
  { value: 'MD', label: 'Maryland (Medical)' },
  { value: 'MT', label: 'Montana (Medical)' },
  { value: 'NH', label: 'New Hampshire (Medical)' },
  { value: 'UT', label: 'Utah (Medical)' },
  { value: 'VT', label: 'Vermont (Medical)' },
  { value: 'VA', label: 'Virginia (Medical)' },
];

const AGE_OPTIONS = [
  { value: '21', label: '21+ (Recreational)' },
  { value: '18', label: '18+ (Medical with card)' },
];

interface ManifestRow {
  id: string;
  manifestNumber: string;
  status: string;
  createdAt: string;
  totalItems: number;
  totalValue: string;
  pdfUrl: string | null;
}

export function CannabisTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manifests, setManifests] = useState<ManifestRow[]>([]);
  const [form, setForm] = useState({
    licenseNumber: '',
    state: '',
    maxVehicleValue: '5000',
    maxVehicleWeight: '',
    requireIdVerification: true,
    requireSignature: true,
    requirePhoto: true,
    minimumAge: '21',
    allowCashOnDelivery: true,
    manifestPrefix: 'MAN',
    deliveryRadiusMiles: '',
    allowedZipCodes: '',
    jurisdiction: '',
  });

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const settings = await api.get<Partial<CannabisSettings>>('/cannabis/settings');
        if (settings && Object.keys(settings).length > 0) {
          setForm({
            licenseNumber: settings.licenseNumber || '',
            state: settings.state || '',
            maxVehicleValue: String(settings.maxVehicleValue ?? 5000),
            maxVehicleWeight: settings.maxVehicleWeight ? String(settings.maxVehicleWeight) : '',
            requireIdVerification: settings.requireIdVerification ?? true,
            requireSignature: settings.requireSignature ?? true,
            requirePhoto: settings.requirePhoto ?? true,
            minimumAge: String(settings.minimumAge ?? 21),
            allowCashOnDelivery: settings.allowCashOnDelivery ?? true,
            manifestPrefix: settings.manifestPrefix || 'MAN',
            deliveryRadiusMiles: settings.deliveryRadiusMiles ? String(settings.deliveryRadiusMiles) : '',
            allowedZipCodes: (settings.allowedZipCodes ?? []).join(', '),
            jurisdiction: settings.jurisdiction || '',
          });
        }
      } catch { /* first time — no settings yet */ }
      setLoading(false);
    }

    async function loadManifests() {
      try {
        const list = await api.get<ManifestRow[]>('/cannabis/manifests?limit=10');
        setManifests(list);
      } catch { /* no manifests yet */ }
    }

    loadSettings();
    loadManifests();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/cannabis/settings', {
        licenseNumber: form.licenseNumber,
        state: form.state,
        maxVehicleValue: Number(form.maxVehicleValue) || 5000,
        maxVehicleWeight: form.maxVehicleWeight ? Number(form.maxVehicleWeight) : null,
        requireIdVerification: form.requireIdVerification,
        requireSignature: form.requireSignature,
        requirePhoto: form.requirePhoto,
        minimumAge: Number(form.minimumAge),
        allowCashOnDelivery: form.allowCashOnDelivery,
        manifestPrefix: form.manifestPrefix,
        deliveryRadiusMiles: form.deliveryRadiusMiles ? Number(form.deliveryRadiusMiles) : null,
        allowedZipCodes: form.allowedZipCodes ? form.allowedZipCodes.split(/[,\n]+/).map(z => z.trim()).filter(Boolean) : [],
        jurisdiction: form.jurisdiction,
      });
      toast('Cannabis settings saved', 'success');
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
          Cannabis Compliance Settings
        </h3>
        <form onSubmit={handleSave}>
          <FormField
            label="Dispensary License Number"
            value={form.licenseNumber}
            onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
            placeholder="e.g., C10-0000001-LIC"
            required
          />

          <SelectField
            label="Operating State"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            options={US_STATES}
            required
          />

          <SelectField
            label="Minimum Customer Age"
            value={form.minimumAge}
            onChange={(e) => setForm({ ...form, minimumAge: e.target.value })}
            options={AGE_OPTIONS}
          />

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 12 }}>
              Delivery Requirements
            </span>
          </div>

          {[
            { key: 'requireIdVerification', label: 'Require ID verification at delivery' },
            { key: 'requireSignature', label: 'Require recipient signature' },
            { key: 'requirePhoto', label: 'Require delivery photo' },
            { key: 'allowCashOnDelivery', label: 'Allow cash on delivery' },
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
              Vehicle Limits
            </span>
          </div>

          <FormField
            label="Max Vehicle Value ($)"
            value={form.maxVehicleValue}
            onChange={(e) => setForm({ ...form, maxVehicleValue: e.target.value })}
            placeholder="5000"
            type="number"
          />

          <FormField
            label="Max Vehicle Weight (g) — optional"
            value={form.maxVehicleWeight}
            onChange={(e) => setForm({ ...form, maxVehicleWeight: e.target.value })}
            placeholder="Leave blank for no limit"
            type="number"
          />

          <FormField
            label="Manifest Number Prefix"
            value={form.manifestPrefix}
            onChange={(e) => setForm({ ...form, manifestPrefix: e.target.value })}
            placeholder="MAN"
          />

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 12 }}>
              Delivery Zones
            </span>
          </div>

          <FormField
            label="Jurisdiction"
            value={form.jurisdiction}
            onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
            placeholder="e.g., San Francisco, Los Angeles County"
          />

          <FormField
            label="Delivery Radius (miles)"
            value={form.deliveryRadiusMiles}
            onChange={(e) => setForm({ ...form, deliveryRadiusMiles: e.target.value })}
            placeholder="e.g., 15 — leave blank for no limit"
            type="number"
          />

          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>
              Allowed Zip Codes
            </span>
            <textarea
              value={form.allowedZipCodes}
              onChange={(e) => setForm({ ...form, allowedZipCodes: e.target.value })}
              placeholder="94102, 94103, 94104&#10;Comma or newline separated"
              style={{
                ...inputStyle, width: '100%', minHeight: 60, resize: 'vertical',
                fontFamily: F.mono, fontSize: 13,
              }}
            />
            <span style={{ fontSize: 11, color: C.muted, display: 'block', marginTop: 4 }}>
              Orders outside the radius AND not in these zip codes will be rejected
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

      {/* Recent manifests */}
      <div style={{
        background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
        padding: 24, flex: '1 1 400px', maxWidth: 520,
      }}>
        <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 20, color: C.text }}>
          Recent Manifests
        </h3>
        {manifests.length === 0 ? (
          <p style={{ color: C.dim, fontSize: 14 }}>
            No manifests yet. Create one from a route to generate a delivery manifest.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {manifests.map(m => (
              <div key={m.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 8, background: C.bg3,
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>
                    {m.manifestNumber}
                  </span>
                  <span style={{
                    marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 4,
                    background: m.status === 'completed' ? C.green : m.status === 'active' ? C.accent : C.muted,
                    color: '#000', fontWeight: 600,
                  }}>
                    {m.status}
                  </span>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                    {m.totalItems} items &middot; ${m.totalValue} &middot; {new Date(m.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {m.pdfUrl && (
                  <a
                    href={m.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12, color: C.accent, textDecoration: 'none',
                      padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.muted}`,
                    }}
                  >
                    PDF
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Kit Management */}
      <KitManagement />
    </div>
  );
}
