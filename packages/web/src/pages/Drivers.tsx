import { useEffect, useState } from 'react';
import { useFleetStore } from '../stores/fleet.js';
import { DataTable, type Column } from '../components/DataTable.js';
import { Badge } from '../components/Badge.js';
import { Pill } from '../components/Pill.js';
import { Modal } from '../components/Modal.js';
import { FormField } from '../components/FormField.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { EmptyState } from '../components/EmptyState.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { useToast } from '../components/Toast.js';
import { C, F } from '../theme.js';
import type { CreateDriverInput } from '@homer-io/shared';

const statusColors: Record<string, string> = {
  available: 'green', on_route: 'blue', on_break: 'yellow', offline: 'dim',
};

const emptyForm: CreateDriverInput = {
  name: '', email: '', phone: '', licenseNumber: '', skillTags: [],
};

export function DriversPage() {
  const {
    drivers, driverPage, driverTotalPages, driverLoading, driverStatusFilter,
    fetchDrivers, createDriver, updateDriver, deleteDriver, setDriverStatusFilter,
  } = useFleetStore();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateDriverInput>(emptyForm);
  const [skillInput, setSkillInput] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDrivers(); }, [driverStatusFilter]);

  const columns: Column<typeof drivers[0]>[] = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email', render: (d) => d.email || '—' },
    { key: 'phone', header: 'Phone', render: (d) => d.phone || '—' },
    { key: 'licenseNumber', header: 'License', render: (d) => d.licenseNumber || '—' },
    {
      key: 'status', header: 'Status',
      render: (d) => <Badge color={statusColors[d.status] || 'dim'}>{d.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'skillTags', header: 'Skills',
      render: (d) => (d.skillTags as string[]).length > 0 ? (d.skillTags as string[]).join(', ') : '—',
    },
    {
      key: 'actions', header: '', width: 100,
      render: (d) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(d); }}
            style={actionBtnStyle}>Edit</button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(d.id); }}
            style={{ ...actionBtnStyle, color: C.red }}>Del</button>
        </div>
      ),
    },
  ];

  function openEdit(driver: typeof drivers[0]) {
    setEditId(driver.id);
    setForm({
      name: driver.name,
      email: driver.email || '',
      phone: driver.phone || '',
      licenseNumber: driver.licenseNumber || '',
      skillTags: driver.skillTags as string[],
    });
    setSkillInput((driver.skillTags as string[]).join(', '));
    setModalOpen(true);
  }

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setSkillInput('');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      ...form,
      skillTags: skillInput.split(',').map(s => s.trim()).filter(Boolean),
    };
    try {
      if (editId) {
        await updateDriver(editId, input);
        toast('Driver updated', 'success');
      } else {
        await createDriver(input);
        toast('Driver added', 'success');
      }
      setModalOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteDriver(deleteId);
      toast('Driver deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
    setDeleteId(null);
  }

  function handleStatusFilter(status: string) {
    setDriverStatusFilter(status === driverStatusFilter ? '' : status);
  }

  if (driverLoading && drivers.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Drivers</h2>
          <p style={{ color: C.dim, fontSize: 14 }}>Manage your driver roster</p>
        </div>
        <button onClick={openAdd} style={primaryBtnStyle}>+ Add Driver</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Pill active={!driverStatusFilter} onClick={() => setDriverStatusFilter('')}>All</Pill>
        <Pill active={driverStatusFilter === 'available'} onClick={() => handleStatusFilter('available')}>Available</Pill>
        <Pill active={driverStatusFilter === 'on_route'} onClick={() => handleStatusFilter('on_route')}>On Route</Pill>
        <Pill active={driverStatusFilter === 'on_break'} onClick={() => handleStatusFilter('on_break')}>On Break</Pill>
        <Pill active={driverStatusFilter === 'offline'} onClick={() => handleStatusFilter('offline')}>Offline</Pill>
      </div>

      {drivers.length === 0 ? (
        <EmptyState icon="👤" title="No drivers yet" description="Add your first driver to get started."
          action={<button onClick={openAdd} style={primaryBtnStyle}>+ Add Driver</button>} />
      ) : (
        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
          <DataTable columns={columns} data={drivers}
            pagination={{ page: driverPage, totalPages: driverTotalPages, onPageChange: fetchDrivers }} />
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Driver' : 'Add Driver'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <FormField label="Email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FormField label="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <FormField label="License Number" value={form.licenseNumber || ''} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
          <FormField label="Skills (comma-separated)" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} placeholder="e.g. heavy-vehicle, fragile, refrigerated" />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" style={primaryBtnStyle}>{editId ? 'Update' : 'Add Driver'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Driver" message="Are you sure you want to delete this driver? This action cannot be undone." />
    </div>
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

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: C.accent, cursor: 'pointer',
  fontSize: 13, fontFamily: F.body, padding: '2px 4px',
};
