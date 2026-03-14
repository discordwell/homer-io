import { useEffect, useState } from 'react';
import { useOrdersStore } from '../stores/orders.js';
import { DataTable, type Column } from '../components/DataTable.js';
import { Badge } from '../components/Badge.js';
import { Pill } from '../components/Pill.js';
import { Modal } from '../components/Modal.js';
import { FormField } from '../components/FormField.js';
import { SelectField } from '../components/SelectField.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { EmptyState } from '../components/EmptyState.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { CsvImportWizard } from '../components/CsvImportWizard.js';
import { useToast } from '../components/Toast.js';
import { C, F } from '../theme.js';

const statusColors: Record<string, string> = {
  received: 'blue', assigned: 'purple', in_transit: 'yellow', delivered: 'green', failed: 'red', returned: 'orange',
};

const priorityColors: Record<string, string> = {
  low: 'dim', normal: 'blue', high: 'orange', urgent: 'red',
};

const emptyForm = {
  recipientName: '', recipientPhone: '', recipientEmail: '',
  street: '', city: '', state: '', zip: '',
  packageCount: 1, priority: 'normal' as const, notes: '',
};

export function OrdersPage() {
  const {
    orders, page, totalPages, total, loading, statusFilter, search,
    fetchOrders, createOrder, deleteOrder, importCsv,
    setStatusFilter, setSearch, setDateFrom, setDateTo,
  } = useOrdersStore();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  function handleSearch() {
    setSearch(searchInput);
    fetchOrders(1);
  }

  const columns: Column<typeof orders[0]>[] = [
    { key: 'id', header: 'ID', width: 80, render: (o) => <span style={{ fontFamily: F.mono, fontSize: 12 }}>{o.id.slice(0, 8)}</span> },
    { key: 'recipientName', header: 'Recipient' },
    { key: 'deliveryAddress', header: 'Address', render: (o) => `${o.deliveryAddress.street}, ${o.deliveryAddress.city}` },
    { key: 'packageCount', header: 'Pkgs', width: 60 },
    { key: 'priority', header: 'Priority', render: (o) => <Badge color={priorityColors[o.priority]}>{o.priority}</Badge> },
    { key: 'status', header: 'Status', render: (o) => <Badge color={statusColors[o.status]}>{o.status.replace('_', ' ')}</Badge> },
    {
      key: 'createdAt', header: 'Created', width: 100,
      render: (o) => new Date(o.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions', header: '', width: 50,
      render: (o) => (
        <button onClick={(e) => { e.stopPropagation(); setDeleteId(o.id); }}
          style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 13, fontFamily: F.body }}>Del</button>
      ),
    },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      recipientName: form.recipientName,
      recipientPhone: form.recipientPhone || undefined,
      recipientEmail: form.recipientEmail || undefined,
      deliveryAddress: { street: form.street, city: form.city, state: form.state, zip: form.zip, country: 'US' },
      packageCount: form.packageCount,
      priority: form.priority,
      notes: form.notes || undefined,
    };
    try {
      await createOrder(input);
      toast('Order created', 'success');
      setModalOpen(false);
      setForm(emptyForm);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteOrder(deleteId);
      toast('Order deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
    setDeleteId(null);
  }

  async function handleCsvImport(rows: Record<string, string>[]) {
    await importCsv(rows);
    toast(`Imported ${rows.length} orders`, 'success');
  }

  if (loading && orders.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Orders</h2>
          <p style={{ color: C.dim, fontSize: 14 }}>{total} total orders</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCsvOpen(true)} style={secondaryBtnStyle}>Import CSV</button>
          <button onClick={() => setModalOpen(true)} style={primaryBtnStyle}>+ Add Order</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Pill active={!statusFilter} onClick={() => setStatusFilter('')}>All</Pill>
        {['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned'].map(s => (
          <Pill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s === statusFilter ? '' : s)}>
            {s.replace('_', ' ')}
          </Pill>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="Search by recipient name..."
          style={{
            flex: 1, padding: '8px 14px', borderRadius: 8, background: C.bg2,
            border: `1px solid ${C.muted}`, color: C.text, fontSize: 14,
            outline: 'none', fontFamily: F.body,
          }}
        />
        <button onClick={handleSearch} style={secondaryBtnStyle}>Search</button>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon="📦" title="No orders yet" description="Add orders manually or import from CSV."
          action={<div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => setCsvOpen(true)} style={secondaryBtnStyle}>Import CSV</button>
            <button onClick={() => setModalOpen(true)} style={primaryBtnStyle}>+ Add Order</button>
          </div>} />
      ) : (
        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
          <DataTable columns={columns} data={orders}
            pagination={{ page, totalPages, onPageChange: fetchOrders }} />
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Order" size="md">
        <form onSubmit={handleSubmit}>
          <FormField label="Recipient Name" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Phone" value={form.recipientPhone} onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })} />
            <FormField label="Email" type="email" value={form.recipientEmail} onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} />
          </div>
          <FormField label="Street Address" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
            <FormField label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
            <FormField label="ZIP" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Packages" type="number" value={form.packageCount} onChange={(e) => setForm({ ...form, packageCount: parseInt(e.target.value) || 1 })} min={1} />
            <SelectField label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
              options={[
                { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
              ]} />
          </div>
          <FormField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" style={primaryBtnStyle}>Create Order</button>
          </div>
        </form>
      </Modal>

      <CsvImportWizard open={csvOpen} onClose={() => setCsvOpen(false)} onImport={handleCsvImport} />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Order" message="Are you sure you want to delete this order?" />
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.accent,
  border: 'none', color: '#fff', cursor: 'pointer', fontFamily: F.body, fontWeight: 600, fontSize: 14,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.text, cursor: 'pointer', fontFamily: F.body, fontSize: 14,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body,
};
