import { useState, useEffect } from 'react';
import { Modal } from '../Modal.js';
import { FormField, inputStyle } from '../FormField.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';
import { webhookEvents } from '@homer-io/shared';

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  description: string | null;
  failureCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
}

interface WebhookEndpointFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { url: string; events: string[]; description?: string; isActive?: boolean }) => Promise<WebhookEndpoint>;
  endpoint?: WebhookEndpoint | null;
}

const eventCategories = [
  {
    label: 'Order Events',
    events: webhookEvents.filter(e => e.startsWith('order.')),
  },
  {
    label: 'Route Events',
    events: webhookEvents.filter(e => e.startsWith('route.')),
  },
  {
    label: 'Delivery Events',
    events: webhookEvents.filter(e => e.startsWith('delivery.')),
  },
  {
    label: 'Driver Events',
    events: webhookEvents.filter(e => e.startsWith('driver.')),
  },
];

export function WebhookEndpointForm({ open, onClose, onSave, endpoint }: WebhookEndpointFormProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = !!endpoint;

  useEffect(() => {
    if (open) {
      if (endpoint) {
        setUrl(endpoint.url);
        setDescription(endpoint.description || '');
        setSelectedEvents([...endpoint.events]);
        setIsActive(endpoint.isActive);
        setRevealedSecret(null);
      } else {
        setUrl('');
        setDescription('');
        setSelectedEvents([]);
        setIsActive(true);
        setRevealedSecret(null);
      }
    }
  }, [open, endpoint]);

  function toggleEvent(event: string) {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event],
    );
  }

  function toggleCategory(events: readonly string[]) {
    const allSelected = events.every(e => selectedEvents.includes(e));
    if (allSelected) {
      setSelectedEvents(prev => prev.filter(e => !events.includes(e as any)));
    } else {
      setSelectedEvents(prev => [...new Set([...prev, ...events])]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (selectedEvents.length === 0) {
      toast('Select at least one event', 'error');
      return;
    }

    if (!url.startsWith('https://')) {
      toast('Webhook URL must use HTTPS', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: { url: string; events: string[]; description?: string; isActive?: boolean } = {
        url,
        events: selectedEvents,
      };
      if (description.trim()) payload.description = description.trim();
      if (isEdit) payload.isActive = isActive;

      const result = await onSave(payload);

      // On create, show the secret
      if (!isEdit && result.secret) {
        setRevealedSecret(result.secret);
        toast('Webhook endpoint created', 'success');
      } else {
        toast('Webhook endpoint updated', 'success');
        onClose();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save webhook endpoint', 'error');
    } finally {
      setSaving(false);
    }
  }

  // If we're showing the secret after creation
  if (revealedSecret) {
    return (
      <Modal open={open} onClose={onClose} title="Webhook Endpoint Created" size="md">
        <div style={{
          background: `${C.yellow}10`, border: `1px solid ${C.yellow}40`,
          borderRadius: 8, padding: 12, marginBottom: 16,
        }}>
          <p style={{ color: C.yellow, fontSize: 13, margin: 0 }}>
            This signing secret will only be shown once. Copy it now and store it securely.
            Use it to verify webhook signatures via the X-Homer-Signature header.
          </p>
        </div>
        <div style={{
          background: C.bg, borderRadius: 8, padding: 16,
          border: `1px solid ${C.muted}`, marginBottom: 16,
        }}>
          <span style={{ color: C.dim, fontSize: 12, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Signing Secret
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{
              color: C.text, fontFamily: F.mono, fontSize: 13,
              wordBreak: 'break-all', flex: 1,
            }}>
              {revealedSecret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(revealedSecret);
                toast('Secret copied to clipboard', 'info');
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
          <button onClick={onClose} style={primaryBtnStyle}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Webhook Endpoint' : 'Add Webhook Endpoint'} size="lg">
      <form onSubmit={handleSubmit}>
        <FormField
          label="Webhook URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/webhook"
          required
        />

        <FormField label="Description">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Sync orders with ERP"
            style={inputStyle}
            maxLength={255}
          />
        </FormField>

        {isEdit && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 8 }}>Status</span>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', fontSize: 14, color: C.text, fontFamily: F.body,
            }}>
              <div
                onClick={() => setIsActive(!isActive)}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: isActive ? C.green : C.muted,
                  position: 'relative', cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 9,
                  background: '#fff', position: 'absolute',
                  top: 2, left: isActive ? 20 : 2,
                  transition: 'left 0.2s ease',
                }} />
              </div>
              {isActive ? 'Active' : 'Inactive'}
            </label>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 10 }}>
            Events *
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {eventCategories.map(category => {
              const allSelected = category.events.every(e => selectedEvents.includes(e));
              const someSelected = category.events.some(e => selectedEvents.includes(e));
              return (
                <div key={category.label}>
                  <label
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 8, cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.body,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={() => toggleCategory(category.events)}
                      style={{ accentColor: C.accent }}
                    />
                    {category.label}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingLeft: 8 }}>
                    {category.events.map(event => (
                      <label
                        key={event}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px', borderRadius: 6,
                          background: selectedEvents.includes(event) ? `${C.accent}15` : C.bg,
                          border: `1px solid ${selectedEvents.includes(event) ? C.accent : C.border}`,
                          cursor: 'pointer', fontSize: 12, color: C.text,
                          fontFamily: F.mono, transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event)}
                          onChange={() => toggleEvent(event)}
                          style={{ accentColor: C.accent }}
                        />
                        {event}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button type="submit" disabled={saving} style={{
            ...primaryBtnStyle,
            opacity: saving ? 0.6 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Endpoint'}
          </button>
        </div>
      </form>
    </Modal>
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
