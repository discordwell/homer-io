import { useEffect, useState } from 'react';
import { useCustomerNotificationsStore } from '../../stores/customer-notifications.js';
import { DataTable, type Column } from '../DataTable.js';
import { Badge } from '../Badge.js';
import { ConfirmDialog } from '../ConfirmDialog.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { NotificationTemplateEditor } from './NotificationTemplateEditor.js';
import { useToast } from '../Toast.js';
import { C, F } from '../../theme.js';
import type { NotificationTemplate, CreateTemplateInput, UpdateTemplateInput } from '../../stores/customer-notifications.js';

const triggerLabels: Record<string, string> = {
  order_assigned: 'Order Assigned',
  driver_en_route: 'Driver En Route',
  delivery_approaching: 'Approaching',
  delivered: 'Delivered',
  failed: 'Failed',
};

const triggerColors: Record<string, string> = {
  order_assigned: 'blue',
  driver_en_route: 'orange',
  delivery_approaching: 'yellow',
  delivered: 'green',
  failed: 'red',
};

interface Props {
  onViewLog?: () => void;
}

export function NotificationsTab({ onViewLog }: Props) {
  const {
    templates, loading,
    fetchTemplates, createTemplate, updateTemplate, deleteTemplate, testTemplate,
  } = useCustomerNotificationsStore();
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAdd() {
    setEditingTemplate(null);
    setEditorOpen(true);
  }

  function handleEdit(template: NotificationTemplate) {
    setEditingTemplate(template);
    setEditorOpen(true);
  }

  async function handleSave(input: CreateTemplateInput | UpdateTemplateInput) {
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, input as UpdateTemplateInput);
        toast('Template updated', 'success');
      } else {
        await createTemplate(input as CreateTemplateInput);
        toast('Template created', 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save template', 'error');
      throw err;
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteTemplate(deleteId);
      toast('Template deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
    setDeleteId(null);
  }

  async function handleTest(id: string) {
    try {
      const result = await testTemplate(id);
      if (result.success) {
        toast('Test notification sent (check logs)', 'success');
      } else {
        toast('Test failed', 'error');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send test', 'error');
    }
  }

  async function handleToggleActive(template: NotificationTemplate) {
    try {
      await updateTemplate(template.id, { isActive: !template.isActive });
      toast(`Template ${template.isActive ? 'deactivated' : 'activated'}`, 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  }

  const columns: Column<NotificationTemplate>[] = [
    {
      key: 'trigger', header: 'Trigger',
      render: (t) => (
        <Badge color={triggerColors[t.trigger] || 'dim'}>
          {triggerLabels[t.trigger] || t.trigger}
        </Badge>
      ),
    },
    {
      key: 'channel', header: 'Channel',
      render: (t) => (
        <span style={{ color: C.text, fontSize: 13, textTransform: 'uppercase', fontWeight: 600 }}>
          {t.channel}
        </span>
      ),
    },
    {
      key: 'subject', header: 'Subject / Body',
      render: (t) => (
        <div style={{ maxWidth: 280 }}>
          {t.subject && (
            <div style={{ color: C.text, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
              {t.subject}
            </div>
          )}
          <div style={{
            color: C.dim, fontSize: 12,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {t.bodyTemplate}
          </div>
        </div>
      ),
    },
    {
      key: 'isActive', header: 'Active', width: 80,
      render: (t) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleActive(t); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <div style={{
            width: 36, height: 20, borderRadius: 10,
            background: t.isActive ? C.green : C.muted,
            position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', position: 'absolute', top: 2,
              left: t.isActive ? 18 : 2, transition: 'left 0.2s',
            }} />
          </div>
        </button>
      ),
    },
    {
      key: 'actions', header: '', width: 120,
      render: (t) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleTest(t.id); }}
            style={{ ...actionBtnStyle, color: C.accent }}
          >
            Test
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteId(t.id); }}
            style={{ ...actionBtnStyle, color: C.red }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (loading && templates.length === 0) return <LoadingSpinner />;

  return (
    <div>
      {/* Provider status indicators */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 20,
        padding: 12, borderRadius: 8,
        background: C.bg, border: `1px solid ${C.border}`,
      }}>
        <ProviderStatus label="Twilio (SMS)" configured={false} />
        <ProviderStatus label="SendGrid (Email)" configured={false} />
        <span style={{ color: C.dim, fontSize: 12, marginLeft: 'auto', alignSelf: 'center' }}>
          Providers can be configured via environment variables
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: C.dim, fontSize: 14 }}>
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          {onViewLog && (
            <button onClick={onViewLog} style={secondaryBtnStyle}>
              View Notification Log
            </button>
          )}
          <button onClick={handleAdd} style={primaryBtnStyle}>
            + Add Template
          </button>
        </div>
      </div>

      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <DataTable columns={columns} data={templates} onRowClick={handleEdit} />
      </div>

      <NotificationTemplateEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        template={editingTemplate}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message="Are you sure you want to delete this notification template? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function ProviderStatus({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: configured ? C.green : C.dim,
      }} />
      <span style={{ color: configured ? C.text : C.dim, fontSize: 13, fontFamily: F.body }}>
        {label}
      </span>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.accent,
  border: 'none', color: '#000', cursor: 'pointer', fontFamily: F.body, fontWeight: 600, fontSize: 14,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body, fontSize: 14,
};

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: C.accent, cursor: 'pointer',
  fontSize: 13, fontFamily: F.body, padding: '2px 4px',
};
