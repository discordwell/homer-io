import { useEffect, useState } from 'react';
import { useFleetStore } from '../stores/fleet.js';
import { DataTable, type Column } from '../components/DataTable.js';
import { Badge } from '../components/Badge.js';
import { Modal } from '../components/Modal.js';
import { FormField } from '../components/FormField.js';
import { SelectField } from '../components/SelectField.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { EmptyState } from '../components/EmptyState.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { useToast } from '../components/Toast.js';
import { C, F, primaryBtnStyle } from '../theme.js';
import type { CreateVehicleInput } from '@homer-io/shared';

const vehicleTypes = [
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' },
  { value: 'bike', label: 'Bike' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'cargo_bike', label: 'Cargo Bike' },
];

const fuelTypes = [
  { value: 'gasoline', label: 'Gasoline' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Electric' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'cng', label: 'CNG' },
];

const emptyForm: CreateVehicleInput = {
  name: '', type: 'van', licensePlate: '', fuelType: 'gasoline',
  capacityWeight: undefined, capacityVolume: undefined, capacityCount: undefined,
};

export function VehiclesPage() {
  const { vehicles, vehiclePage, vehicleTotalPages, vehicleLoading, fetchVehicles, createVehicle, updateVehicle, deleteVehicle } = useFleetStore();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateVehicleInput>(emptyForm);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchVehicles(); }, []);

  const columns: Column<typeof vehicles[0]>[] = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type', render: (v) => <Badge color="blue">{v.type.replace('_', ' ')}</Badge> },
    { key: 'licensePlate', header: 'License Plate', render: (v) => v.licensePlate || '—' },
    { key: 'fuelType', header: 'Fuel', render: (v) => v.fuelType },
    { key: 'capacityCount', header: 'Capacity', render: (v) => v.capacityCount ? `${v.capacityCount} pkg` : '—' },
    { key: 'isActive', header: 'Status', render: (v) => <Badge color={v.isActive ? 'green' : 'dim'}>{v.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', header: '', width: 100,
      render: (v) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(v); }}
            style={actionBtnStyle}>Edit</button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(v.id); }}
            style={{ ...actionBtnStyle, color: C.red }}>Del</button>
        </div>
      ),
    },
  ];

  function openEdit(vehicle: typeof vehicles[0]) {
    setEditId(vehicle.id);
    setForm({
      name: vehicle.name,
      type: vehicle.type as CreateVehicleInput['type'],
      licensePlate: vehicle.licensePlate || '',
      fuelType: vehicle.fuelType as CreateVehicleInput['fuelType'],
      capacityWeight: vehicle.capacityWeight ? Number(vehicle.capacityWeight) : undefined,
      capacityVolume: vehicle.capacityVolume ? Number(vehicle.capacityVolume) : undefined,
      capacityCount: vehicle.capacityCount || undefined,
    });
    setModalOpen(true);
  }

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editId) {
        await updateVehicle(editId, form);
        toast('Vehicle updated', 'success');
      } else {
        await createVehicle(form);
        toast('Vehicle added', 'success');
      }
      setModalOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteVehicle(deleteId);
      toast('Vehicle deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
    setDeleteId(null);
  }

  if (vehicleLoading && vehicles.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Vehicles</h2>
          <p style={{ color: C.dim, fontSize: 14 }}>Manage your fleet vehicles</p>
        </div>
        <div className="page-header-actions">
          <button onClick={openAdd} style={primaryBtnStyle}>+ Add Vehicle</button>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState icon="🚛" title="No vehicles yet" description="Add your first vehicle to get started."
          action={<button onClick={openAdd} style={primaryBtnStyle}>+ Add Vehicle</button>} />
      ) : (
        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
          <DataTable columns={columns} data={vehicles}
            pagination={{ page: vehiclePage, totalPages: vehicleTotalPages, onPageChange: fetchVehicles }} />
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Vehicle' : 'Add Vehicle'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <SelectField label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CreateVehicleInput['type'] })} options={vehicleTypes} required />
          <FormField label="License Plate" value={form.licensePlate || ''} onChange={(e) => setForm({ ...form, licensePlate: e.target.value })} />
          <SelectField label="Fuel Type" value={form.fuelType!} onChange={(e) => setForm({ ...form, fuelType: e.target.value as CreateVehicleInput['fuelType'] })} options={fuelTypes} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="Weight Cap (kg)" type="number" value={form.capacityWeight ?? ''} onChange={(e) => setForm({ ...form, capacityWeight: e.target.value ? Number(e.target.value) : undefined })} />
            <FormField label="Volume Cap (m³)" type="number" value={form.capacityVolume ?? ''} onChange={(e) => setForm({ ...form, capacityVolume: e.target.value ? Number(e.target.value) : undefined })} step="0.1" />
            <FormField label="Package Cap" type="number" value={form.capacityCount ?? ''} onChange={(e) => setForm({ ...form, capacityCount: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" style={primaryBtnStyle}>{editId ? 'Update' : 'Add Vehicle'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Vehicle" message="Are you sure you want to delete this vehicle? This action cannot be undone." />
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
