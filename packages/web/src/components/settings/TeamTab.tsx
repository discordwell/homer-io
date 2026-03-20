import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settings.js';
import { useAuthStore } from '../../stores/auth.js';
import { DataTable, type Column } from '../DataTable.js';
import { Badge } from '../Badge.js';
import { Modal } from '../Modal.js';
import { FormField } from '../FormField.js';
import { SelectField } from '../SelectField.js';
import { ConfirmDialog } from '../ConfirmDialog.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { C, F, primaryBtnStyle } from '../../theme.js';
import type { Role } from '@homer-io/shared';

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'driver', label: 'Driver' },
];

const allRoleOptions = [
  { value: 'owner', label: 'Owner' },
  ...roleOptions,
];

interface InviteForm {
  email: string;
  name: string;
  role: string;
}

const emptyInviteForm: InviteForm = { email: '', name: '', role: 'dispatcher' };

export function TeamTab() {
  const { teamMembers, loading, fetchTeam, inviteUser, updateRole, deactivateUser } = useSettingsStore();
  const currentUser = useAuthStore(s => s.user);
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>(emptyInviteForm);
  const [credentialsModal, setCredentialsModal] = useState<{ email: string; tempPassword: string } | null>(null);
  const [roleEditId, setRoleEditId] = useState<string | null>(null);
  const [roleEditValue, setRoleEditValue] = useState<string>('dispatcher');
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  useEffect(() => {
    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOwner = currentUser?.role === 'owner';

  const columns: Column<(typeof teamMembers)[0]>[] = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    {
      key: 'role', header: 'Role',
      render: (m) => {
        const color = m.role === 'owner' ? 'purple' : m.role === 'admin' ? 'blue' : m.role === 'dispatcher' ? 'yellow' : 'dim';
        return <Badge color={color}>{m.role}</Badge>;
      },
    },
    {
      key: 'isActive', header: 'Status',
      render: (m) => <Badge color={m.isActive ? 'green' : 'dim'}>{m.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions', header: '', width: 160,
      render: (m) => {
        if (m.id === currentUser?.id) return null;
        if (m.role === 'owner') return null;
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            {isOwner && (
              <button
                onClick={(e) => { e.stopPropagation(); setRoleEditId(m.id); setRoleEditValue(m.role); }}
                style={actionBtnStyle}
              >
                Role
              </button>
            )}
            {m.isActive && (
              <button
                onClick={(e) => { e.stopPropagation(); setDeactivateId(m.id); }}
                style={{ ...actionBtnStyle, color: C.red }}
              >
                Deactivate
              </button>
            )}
          </div>
        );
      },
    },
  ];

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await inviteUser({
        email: inviteForm.email,
        name: inviteForm.name,
        role: inviteForm.role as Role,
      });
      setInviteOpen(false);
      setInviteForm(emptyInviteForm);
      setCredentialsModal({ email: result.email, tempPassword: result.tempPassword });
      toast('Team member invited', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to invite', 'error');
    }
  }

  async function handleRoleUpdate() {
    if (!roleEditId) return;
    try {
      await updateRole(roleEditId, roleEditValue as Role);
      toast('Role updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update role', 'error');
    }
    setRoleEditId(null);
  }

  async function handleDeactivate() {
    if (!deactivateId) return;
    try {
      await deactivateUser(deactivateId);
      toast('Member deactivated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to deactivate', 'error');
    }
    setDeactivateId(null);
  }

  if (loading && teamMembers.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: C.dim, fontSize: 14 }}>
          {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}
        </span>
        <button onClick={() => setInviteOpen(true)} style={primaryBtnStyle}>
          + Invite Member
        </button>
      </div>

      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <DataTable columns={columns} data={teamMembers} />
      </div>

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Team Member">
        <form onSubmit={handleInvite}>
          <FormField
            label="Email"
            type="email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            placeholder="team@example.com"
            required
          />
          <FormField
            label="Name"
            value={inviteForm.name}
            onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
            placeholder="Full name"
            required
          />
          <SelectField
            label="Role"
            value={inviteForm.role}
            onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
            options={roleOptions}
            required
          />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setInviteOpen(false)} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" style={primaryBtnStyle}>Send Invite</button>
          </div>
        </form>
      </Modal>

      {/* Credentials Modal (shown after invite) */}
      <Modal
        open={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title="Temporary Credentials"
        size="sm"
      >
        <p style={{ color: C.dim, fontSize: 14, marginBottom: 16 }}>
          Share these credentials with the new team member. They should change their password on first login.
        </p>
        <div style={{
          background: C.bg, borderRadius: 8, padding: 16,
          border: `1px solid ${C.muted}`, marginBottom: 16,
        }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: C.dim, fontSize: 12, display: 'block', marginBottom: 4 }}>Email</span>
            <span style={{ color: C.text, fontFamily: F.mono, fontSize: 14 }}>{credentialsModal?.email}</span>
          </div>
          <div>
            <span style={{ color: C.dim, fontSize: 12, display: 'block', marginBottom: 4 }}>Temporary Password</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.text, fontFamily: F.mono, fontSize: 14 }}>{credentialsModal?.tempPassword}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(credentialsModal?.tempPassword || '');
                  toast('Password copied', 'info');
                }}
                style={{
                  background: C.bg3, border: `1px solid ${C.muted}`, color: C.dim,
                  padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 12, fontFamily: F.body,
                }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setCredentialsModal(null)} style={primaryBtnStyle}>Done</button>
        </div>
      </Modal>

      {/* Role Edit Modal */}
      <Modal open={!!roleEditId} onClose={() => setRoleEditId(null)} title="Change Role" size="sm">
        <SelectField
          label="New Role"
          value={roleEditValue}
          onChange={(e) => setRoleEditValue(e.target.value)}
          options={allRoleOptions}
          required
        />
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={() => setRoleEditId(null)} style={cancelBtnStyle}>Cancel</button>
          <button onClick={handleRoleUpdate} style={primaryBtnStyle}>Update Role</button>
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmDialog
        open={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Member"
        message="Are you sure you want to deactivate this team member? They will no longer be able to log in."
        confirmLabel="Deactivate"
        variant="danger"
      />
    </div>
  );
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body,
};

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: C.accent, cursor: 'pointer',
  fontSize: 13, fontFamily: F.body, padding: '2px 4px',
};
