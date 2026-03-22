import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { SelectField } from '../SelectField.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';

interface FurnitureSettings {
  defaultCrewSize: number;
  assemblyService: boolean;
  haulAwayService: boolean;
  defaultTimeWindowHours: number;
  whiteGloveChecklist: boolean;
}

const CREW_SIZE_OPTIONS = [
  { value: '1', label: '1 person' },
  { value: '2', label: '2 people' },
  { value: '3', label: '3 people' },
  { value: '4', label: '4 people' },
];

const TIME_WINDOW_OPTIONS = [
  { value: '2', label: '2 hours' },
  { value: '3', label: '3 hours' },
  { value: '4', label: '4 hours' },
];

export function FurnitureTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    defaultCrewSize: '2',
    assemblyService: false,
    haulAwayService: false,
    defaultTimeWindowHours: '3',
    whiteGloveChecklist: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const settings = await api.get<Partial<FurnitureSettings>>('/furniture/settings');
      if (settings && Object.keys(settings).length > 0) {
        setForm({
          defaultCrewSize: String(settings.defaultCrewSize ?? 2),
          assemblyService: settings.assemblyService ?? false,
          haulAwayService: settings.haulAwayService ?? false,
          defaultTimeWindowHours: String(settings.defaultTimeWindowHours ?? 3),
          whiteGloveChecklist: settings.whiteGloveChecklist ?? false,
        });
      }
    } catch { /* first time -- no settings yet */ }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/furniture/settings', {
        defaultCrewSize: Number(form.defaultCrewSize) || 2,
        assemblyService: form.assemblyService,
        haulAwayService: form.haulAwayService,
        defaultTimeWindowHours: Number(form.defaultTimeWindowHours) || 3,
        whiteGloveChecklist: form.whiteGloveChecklist,
      });
      toast('Furniture settings saved', 'success');
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
          Furniture Delivery Settings
        </h3>
        <form onSubmit={handleSave}>
          <SelectField
            label="Default Crew Size"
            value={form.defaultCrewSize}
            onChange={(e) => setForm({ ...form, defaultCrewSize: e.target.value })}
            options={CREW_SIZE_OPTIONS}
          />

          <SelectField
            label="Default Time Window Size"
            value={form.defaultTimeWindowHours}
            onChange={(e) => setForm({ ...form, defaultTimeWindowHours: e.target.value })}
            options={TIME_WINDOW_OPTIONS}
          />

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 12 }}>
              Service Options
            </span>
          </div>

          {[
            { key: 'assemblyService' as const, label: 'Offer assembly service' },
            { key: 'haulAwayService' as const, label: 'Offer haul-away service' },
            { key: 'whiteGloveChecklist' as const, label: 'Enable white-glove service checklist' },
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
          <span style={{ fontSize: 11, color: C.muted, display: 'block', marginTop: 4, marginBottom: 16 }}>
            White-glove checklist requires drivers to confirm item placement, packaging removal, and customer walkthrough.
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
