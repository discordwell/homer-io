import React, { useEffect, useState } from 'react';
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
import { api } from '../api/client.js';
import { hashAddressBrowser } from '../utils/address-hash.js';
import { C, F, alpha, primaryBtnStyle, secondaryBtnStyle } from '../theme.js';
import { useSettingsStore } from '../stores/settings.js';

interface AddressIntelligence {
  addressHash: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  avgServiceTimeSeconds: number | null;
  accessInstructions: string | null;
  parkingNotes: string | null;
  commonFailureReasons: Array<{ reason: string; count: number }>;
  recentMetrics: Array<{
    deliveryStatus: string;
    failureCategory: string | null;
    serviceTimeSeconds: number | null;
    completedAt: string;
  }>;
}

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
  isGift: false, senderName: '', senderEmail: '', senderPhone: '', giftMessage: '',
  // Pharmacy fields
  isControlledSubstance: false, controlledSchedule: '' as string,
  isColdChain: false, patientDob: '', prescriberName: '', prescriberNpi: '',
  driverNotesHipaa: '',
  // Grocery fields
  substitutionAllowed: true, temperatureZone: 'ambient' as string, substitutionNotes: '',
  // Furniture fields
  crewSize: '2', assemblyRequired: false, haulAway: false,
};

export function OrdersPage() {
  const {
    orders, page, totalPages, total, loading, statusFilter, search,
    fetchOrders, createOrder, deleteOrder, importCsv,
    setStatusFilter, setSearch,
  } = useOrdersStore();
  const { toast } = useToast();
  const { orgSettings } = useSettingsStore();
  const isFlorist = orgSettings?.industry === 'florist';
  const isPharmacy = orgSettings?.industry === 'pharmacy';
  const isGrocery = orgSettings?.industry === 'grocery';
  const isFurniture = orgSettings?.industry === 'furniture';
  const [modalOpen, setModalOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [searchInput, setSearchInput] = useState(search);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchStatus, setBatchStatus] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [intelData, setIntelData] = useState<AddressIntelligence | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOrders(); }, [statusFilter]);
  useEffect(() => { setSelectedIds(new Set()); }, [orders]);

  const intelRequestRef = React.useRef(0);

  async function toggleOrderExpand(order: typeof orders[0]) {
    if (expandedOrderId === order.id) {
      setExpandedOrderId(null);
      setIntelData(null);
      return;
    }
    const requestId = ++intelRequestRef.current;
    setExpandedOrderId(order.id);
    setIntelData(null);
    setIntelLoading(true);
    try {
      const hash = await hashAddressBrowser(order.deliveryAddress);
      if (intelRequestRef.current !== requestId) return; // stale
      const data = await api.get<AddressIntelligence>(`/intelligence/address/${hash}`);
      if (intelRequestRef.current !== requestId) return; // stale
      setIntelData(data);
    } catch {
      if (intelRequestRef.current === requestId) setIntelData(null);
    } finally {
      if (intelRequestRef.current === requestId) setIntelLoading(false);
    }
  }

  function handleSearch() {
    setSearch(searchInput);
    fetchOrders(1);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  }

  async function handleBatchStatus() {
    if (!batchStatus || selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const result = await api.post<{ updated: number }>('/orders/batch/status', {
        orderIds: Array.from(selectedIds),
        status: batchStatus,
      });
      toast(`Updated ${result.updated} orders to "${batchStatus}"`, 'success');
      setSelectedIds(new Set());
      setBatchStatus('');
      fetchOrders(page);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Batch update failed', 'error');
    } finally {
      setBatchLoading(false);
    }
  }

  const columns: Column<typeof orders[0]>[] = [
    {
      key: 'select', header: (
        <input type="checkbox" checked={orders.length > 0 && selectedIds.size === orders.length}
          onChange={toggleSelectAll} style={{ accentColor: C.accent, cursor: 'pointer' }} />
      ) as unknown as string, width: 36,
      render: (o) => (
        <input type="checkbox" checked={selectedIds.has(o.id)}
          onChange={() => toggleSelect(o.id)}
          onClick={(e) => e.stopPropagation()}
          style={{ accentColor: C.accent, cursor: 'pointer' }} />
      ),
    },
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
    const input: Record<string, unknown> = {
      recipientName: form.recipientName,
      recipientPhone: form.recipientPhone || undefined,
      recipientEmail: form.recipientEmail || undefined,
      deliveryAddress: { street: form.street, city: form.city, state: form.state, zip: form.zip, country: 'US' },
      packageCount: form.packageCount,
      priority: form.priority,
      notes: form.notes || undefined,
      isGift: form.isGift,
    };
    if (form.isGift) {
      input.senderName = form.senderName || undefined;
      input.senderEmail = form.senderEmail || undefined;
      input.senderPhone = form.senderPhone || undefined;
      input.giftMessage = form.giftMessage || undefined;
    }
    if (isPharmacy) {
      input.isControlledSubstance = form.isControlledSubstance;
      if (form.isControlledSubstance && form.controlledSchedule) {
        input.controlledSchedule = form.controlledSchedule;
      }
      input.isColdChain = form.isColdChain;
      input.patientDob = form.patientDob || undefined;
      input.prescriberName = form.prescriberName || undefined;
      input.prescriberNpi = form.prescriberNpi || undefined;
      input.driverNotesHipaa = form.driverNotesHipaa || undefined;
    }
    if (isGrocery) {
      input.substitutionAllowed = form.substitutionAllowed;
      input.temperatureZone = form.temperatureZone || undefined;
      input.substitutionNotes = form.substitutionNotes || undefined;
    }
    if (isFurniture) {
      input.crewSize = Number(form.crewSize) || 2;
      input.assemblyRequired = form.assemblyRequired;
      input.haulAway = form.haulAway;
    }
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Orders</h2>
          <p style={{ color: C.dim, fontSize: 14 }}>{total} total orders</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCsvOpen(true)} style={secondaryBtnStyle}>Import CSV</button>
          <button onClick={() => { setForm({ ...emptyForm, isGift: isFlorist }); setModalOpen(true); }} style={primaryBtnStyle}>+ Add Order</button>
        </div>
      </div>

      <div className="filter-pills" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Pill active={!statusFilter} onClick={() => setStatusFilter('')}>All</Pill>
        {['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned'].map(s => (
          <Pill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s === statusFilter ? '' : s)}>
            {s.replace('_', ' ')}
          </Pill>
        ))}
      </div>

      <div className="search-row" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-action-bar" style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          background: alpha(C.accent, 0.08), border: `1px solid ${alpha(C.accent, 0.20)}`,
          borderRadius: 8, marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
            {selectedIds.size} selected
          </span>
          <select value={batchStatus} onChange={(e) => setBatchStatus(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 6, background: C.bg3,
              border: `1px solid ${C.muted}`, color: C.text, fontSize: 13,
              fontFamily: F.body, outline: 'none',
            }}>
            <option value="">Set status...</option>
            {['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned'].map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <button onClick={handleBatchStatus} disabled={!batchStatus || batchLoading}
            style={{
              ...primaryBtnStyle, padding: '6px 14px', fontSize: 13,
              opacity: !batchStatus || batchLoading ? 0.5 : 1,
            }}>
            {batchLoading ? 'Updating...' : 'Apply'}
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 13, fontFamily: F.body }}>
            Clear
          </button>
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState icon="📦" title="No orders yet" description="Add orders manually or import from CSV."
          action={<div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => setCsvOpen(true)} style={secondaryBtnStyle}>Import CSV</button>
            <button onClick={() => { setForm({ ...emptyForm, isGift: isFlorist }); setModalOpen(true); }} style={primaryBtnStyle}>+ Add Order</button>
          </div>} />
      ) : (
        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16, overflowX: 'auto' }}>
          <DataTable columns={columns} data={orders}
            onRowClick={toggleOrderExpand}
            pagination={{ page, totalPages, onPageChange: fetchOrders }} />

          {/* Expandable address intelligence panel */}
          {expandedOrderId && (
            <AddressIntelligencePanel
              orderId={expandedOrderId}
              data={intelData}
              loading={intelLoading}
              onClose={() => { setExpandedOrderId(null); setIntelData(null); }}
            />
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Order" size="md">
        <form onSubmit={handleSubmit}>
          <FormField label="Recipient Name" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} required />
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Phone" value={form.recipientPhone} onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })} />
            <FormField label="Email" type="email" value={form.recipientEmail} onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} />
          </div>
          <FormField label="Street Address" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} required />
          <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
            <FormField label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
            <FormField label="ZIP" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} required />
          </div>
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Packages" type="number" value={form.packageCount} onChange={(e) => setForm({ ...form, packageCount: parseInt(e.target.value) || 1 })} min={1} />
            <SelectField label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as typeof emptyForm.priority })}
              options={[
                { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
              ]} />
          </div>
          <FormField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          {/* Gift delivery section */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 12 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isGift}
                onChange={(e) => setForm({ ...form, isGift: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: C.accent }}
              />
              <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>This is a gift</span>
            </label>
          </div>

          {form.isGift && (
            <div style={{
              background: alpha(C.purple, 0.04), borderRadius: 8,
              border: `1px solid ${alpha(C.purple, 0.12)}`, padding: 16, marginBottom: 16,
            }}>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Sender Name" value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} />
                <FormField label="Sender Phone" value={form.senderPhone} onChange={(e) => setForm({ ...form, senderPhone: e.target.value })} />
              </div>
              <FormField label="Sender Email" type="email" value={form.senderEmail} onChange={(e) => setForm({ ...form, senderEmail: e.target.value })} />
              <label style={{ display: 'block', marginBottom: 0 }}>
                <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>Gift Message</span>
                <textarea
                  value={form.giftMessage}
                  onChange={(e) => setForm({ ...form, giftMessage: e.target.value })}
                  placeholder="Optional message included with delivery"
                  style={{
                    width: '100%', padding: 12, borderRadius: 8,
                    background: C.bg, border: `1px solid ${C.muted}`,
                    color: C.text, fontSize: 14, outline: 'none',
                    fontFamily: F.body, boxSizing: 'border-box' as const,
                    minHeight: 80, resize: 'vertical' as const,
                  }}
                />
              </label>
            </div>
          )}

          {/* Pharmacy fields */}
          {isPharmacy && (
            <>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>Pharmacy Fields</span>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.isControlledSubstance}
                    onChange={(e) => setForm({ ...form, isControlledSubstance: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: C.accent }}
                  />
                  <span style={{ fontSize: 14, color: C.text }}>Controlled Substance</span>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.isColdChain}
                    onChange={(e) => setForm({ ...form, isColdChain: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: C.accent }}
                  />
                  <span style={{ fontSize: 14, color: C.text }}>Cold Chain / Temperature-Sensitive</span>
                </label>
              </div>

              {form.isControlledSubstance && (
                <SelectField
                  label="Schedule"
                  value={form.controlledSchedule}
                  onChange={(e) => setForm({ ...form, controlledSchedule: e.target.value })}
                  options={[
                    { value: '', label: 'Select schedule...' },
                    { value: 'II', label: 'Schedule II' },
                    { value: 'III', label: 'Schedule III' },
                    { value: 'IV', label: 'Schedule IV' },
                    { value: 'V', label: 'Schedule V' },
                  ]}
                />
              )}

              <FormField
                label="Patient DOB"
                type="date"
                value={form.patientDob}
                onChange={(e) => setForm({ ...form, patientDob: e.target.value })}
              />

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField
                  label="Prescriber Name"
                  value={form.prescriberName}
                  onChange={(e) => setForm({ ...form, prescriberName: e.target.value })}
                  placeholder="Dr. Jane Smith"
                />
                <FormField
                  label="Prescriber NPI"
                  value={form.prescriberNpi}
                  onChange={(e) => setForm({ ...form, prescriberNpi: e.target.value })}
                  placeholder="1234567890"
                />
              </div>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>Driver Notes (HIPAA-safe)</span>
                <textarea
                  value={form.driverNotesHipaa}
                  onChange={(e) => setForm({ ...form, driverNotesHipaa: e.target.value })}
                  placeholder="Delivery instructions visible to driver — do not include PHI"
                  style={{
                    width: '100%', padding: 12, borderRadius: 8,
                    background: C.bg, border: `1px solid ${C.muted}`,
                    color: C.text, fontSize: 14, outline: 'none',
                    fontFamily: F.body, boxSizing: 'border-box' as const,
                    minHeight: 80, resize: 'vertical' as const,
                  }}
                />
              </label>
            </>
          )}

          {/* Grocery fields */}
          {isGrocery && (
            <>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>Grocery Fields</span>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.substitutionAllowed}
                    onChange={(e) => setForm({ ...form, substitutionAllowed: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: C.accent }}
                  />
                  <span style={{ fontSize: 14, color: C.text }}>Substitutions Allowed</span>
                </label>
              </div>

              <SelectField
                label="Temperature Zone"
                value={form.temperatureZone}
                onChange={(e) => setForm({ ...form, temperatureZone: e.target.value })}
                options={[
                  { value: 'ambient', label: 'Ambient' },
                  { value: 'refrigerated', label: 'Refrigerated' },
                  { value: 'frozen', label: 'Frozen' },
                ]}
              />

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>Substitution Notes</span>
                <textarea
                  value={form.substitutionNotes}
                  onChange={(e) => setForm({ ...form, substitutionNotes: e.target.value })}
                  placeholder="e.g., No gluten-free substitutions, prefer organic"
                  style={{
                    width: '100%', padding: 12, borderRadius: 8,
                    background: C.bg, border: `1px solid ${C.muted}`,
                    color: C.text, fontSize: 14, outline: 'none',
                    fontFamily: F.body, boxSizing: 'border-box' as const,
                    minHeight: 80, resize: 'vertical' as const,
                  }}
                />
              </label>
            </>
          )}

          {/* Furniture fields */}
          {isFurniture && (
            <>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>Furniture Fields</span>
              </div>

              <SelectField
                label="Crew Size"
                value={form.crewSize}
                onChange={(e) => setForm({ ...form, crewSize: e.target.value })}
                options={[
                  { value: '1', label: '1 person' },
                  { value: '2', label: '2 people' },
                  { value: '3', label: '3 people' },
                  { value: '4', label: '4 people' },
                ]}
              />

              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.assemblyRequired}
                    onChange={(e) => setForm({ ...form, assemblyRequired: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: C.accent }}
                  />
                  <span style={{ fontSize: 14, color: C.text }}>Assembly Required</span>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.haulAway}
                    onChange={(e) => setForm({ ...form, haulAway: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: C.accent }}
                  />
                  <span style={{ fontSize: 14, color: C.text }}>Haul-Away</span>
                </label>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
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

const cancelBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body,
};

function AddressIntelligencePanel({ data, loading, onClose }: {
  orderId?: string;
  data: AddressIntelligence | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div style={{
      marginTop: 12, background: C.bg3, borderRadius: 10,
      border: `1px solid ${C.muted}`, padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 600, color: C.text }}>
          Address Intelligence
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 16,
        }}>&times;</button>
      </div>

      {loading && (
        <div style={{ color: C.dim, fontSize: 13, padding: 12, textAlign: 'center' }}>Loading intelligence...</div>
      )}

      {!loading && !data && (
        <div style={{ color: C.dim, fontSize: 13, padding: 12, textAlign: 'center' }}>
          No intelligence yet for this address
        </div>
      )}

      {!loading && data && (
        <div>
          {/* Stats row */}
          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <StatBox label="Deliveries" value={data.totalDeliveries} />
            <StatBox
              label="Success Rate"
              value={data.totalDeliveries > 0 ? `${Math.round((data.successfulDeliveries / data.totalDeliveries) * 100)}%` : '\u2014'}
              color={data.totalDeliveries > 0 && (data.successfulDeliveries / data.totalDeliveries) < 0.7 ? C.red : C.green}
            />
            <StatBox
              label="Avg Service"
              value={data.avgServiceTimeSeconds ? `${(data.avgServiceTimeSeconds / 60).toFixed(1)} min` : '\u2014'}
            />
            <StatBox label="Failures" value={data.failedDeliveries} color={data.failedDeliveries > 0 ? C.orange : undefined} />
          </div>

          {/* Access instructions / parking */}
          {(data.accessInstructions || data.parkingNotes) && (
            <div style={{ marginBottom: 12 }}>
              {data.accessInstructions && (
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>
                  <span style={{ color: C.text, fontWeight: 600 }}>Access:</span> {String(data.accessInstructions)}
                </div>
              )}
              {data.parkingNotes && (
                <div style={{ fontSize: 12, color: C.dim }}>
                  <span style={{ color: C.text, fontWeight: 600 }}>Parking:</span> {String(data.parkingNotes)}
                </div>
              )}
            </div>
          )}

          {/* Failure reasons */}
          {data.commonFailureReasons.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>Common Failure Reasons</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {data.commonFailureReasons.map((r, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 999, fontSize: 11,
                    fontWeight: 600, fontFamily: F.body,
                    background: alpha(C.red, 0.09), color: C.red,
                    border: `1px solid ${alpha(C.red, 0.19)}`,
                  }}>
                    {r.reason.replace(/_/g, ' ')} ({r.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: F.mono, color: color || C.text }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{label}</div>
    </div>
  );
}
