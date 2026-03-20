import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../Modal.js';
import { FormField, inputStyle } from '../FormField.js';
import { SelectField } from '../SelectField.js';
import { C, F, alpha, primaryBtnStyle } from '../../theme.js';
import type { NotificationTemplate, CreateTemplateInput, UpdateTemplateInput } from '../../stores/customer-notifications.js';

const triggerOptions = [
  { value: 'order_assigned', label: 'Order Assigned' },
  { value: 'driver_en_route', label: 'Driver En Route' },
  { value: 'delivery_approaching', label: 'Delivery Approaching' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
];

const channelOptions = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
];

const templateVariables = [
  { key: '{{recipientName}}', label: 'Recipient Name' },
  { key: '{{driverName}}', label: 'Driver Name' },
  { key: '{{eta}}', label: 'ETA' },
  { key: '{{trackingUrl}}', label: 'Tracking URL' },
  { key: '{{orderRef}}', label: 'Order Reference' },
];

const sampleData: Record<string, string> = {
  '{{recipientName}}': 'Jane Doe',
  '{{driverName}}': 'John Smith',
  '{{eta}}': '2:30 PM',
  '{{trackingUrl}}': 'https://track.homer.io/abc123',
  '{{orderRef}}': 'ORD-00042',
};

interface Props {
  open: boolean;
  onClose: () => void;
  template: NotificationTemplate | null;
  onSave: (input: CreateTemplateInput | UpdateTemplateInput) => Promise<void>;
}

export function NotificationTemplateEditor({ open, onClose, template, onSave }: Props) {
  const [trigger, setTrigger] = useState('order_assigned');
  const [channel, setChannel] = useState('sms');
  const [subject, setSubject] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setTrigger(template.trigger);
      setChannel(template.channel);
      setSubject(template.subject || '');
      setBodyTemplate(template.bodyTemplate);
      setIsActive(template.isActive);
    } else {
      setTrigger('order_assigned');
      setChannel('sms');
      setSubject('');
      setBodyTemplate('');
      setIsActive(true);
    }
  }, [template, open]);

  const preview = useMemo(() => {
    let text = bodyTemplate;
    for (const [key, value] of Object.entries(sampleData)) {
      text = text.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    return text;
  }, [bodyTemplate]);

  const subjectPreview = useMemo(() => {
    let text = subject;
    for (const [key, value] of Object.entries(sampleData)) {
      text = text.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    return text;
  }, [subject]);

  function insertVariable(varKey: string) {
    setBodyTemplate(prev => prev + varKey);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        trigger,
        channel,
        subject: channel === 'email' ? subject : undefined,
        bodyTemplate,
        isActive,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={template ? 'Edit Template' : 'Add Template'} size="lg">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SelectField
            label="Trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            options={triggerOptions}
            required
          />
          <SelectField
            label="Channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            options={channelOptions}
            required
          />
        </div>

        {channel === 'email' && (
          <FormField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Your delivery {{orderRef}} is on its way!"
            required
          />
        )}

        <div style={{ marginBottom: 16 }}>
          <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>
            Body Template *
          </span>
          <textarea
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            placeholder="Hi {{recipientName}}, your order {{orderRef}} is on its way! Track it here: {{trackingUrl}}"
            required
            rows={5}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: 100,
            }}
          />
        </div>

        {/* Variable picker */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ color: C.dim, fontSize: 12, display: 'block', marginBottom: 8 }}>
            Insert Variable
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {templateVariables.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                style={{
                  padding: '4px 10px', borderRadius: 6,
                  background: alpha(C.accent, 0.08), border: `1px solid ${alpha(C.accent, 0.19)}`,
                  color: C.accent, cursor: 'pointer', fontSize: 12,
                  fontFamily: F.mono,
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {bodyTemplate && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ color: C.dim, fontSize: 12, display: 'block', marginBottom: 8 }}>
              Preview
            </span>
            <div style={{
              background: C.bg, borderRadius: 8, padding: 16,
              border: `1px solid ${C.muted}`,
            }}>
              {channel === 'email' && subjectPreview && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: C.dim, fontSize: 11, textTransform: 'uppercase' }}>Subject: </span>
                  <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{subjectPreview}</span>
                </div>
              )}
              <p style={{
                color: C.text, fontSize: 14, margin: 0,
                whiteSpace: 'pre-wrap', lineHeight: 1.6,
              }}>
                {preview}
              </p>
            </div>
          </div>
        )}

        {/* Active toggle */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
          cursor: 'pointer', fontSize: 14, color: C.text, fontFamily: F.body,
        }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            style={{ accentColor: C.accent, width: 16, height: 16 }}
          />
          Active
        </label>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button type="submit" disabled={saving} style={{
            ...primaryBtnStyle,
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Saving...' : template ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body,
};
