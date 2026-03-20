import { DataTable, type Column } from '../components/DataTable.js';
import { Badge } from '../components/Badge.js';
import { useToast } from '../components/Toast.js';
import { C, F } from '../theme.js';
import {
  DEMO_VEHICLES, DEMO_DRIVERS,
  type DemoVehicle, type DemoDriver,
} from '../data/demo-data.js';

const driverStatusColors: Record<string, string> = {
  available: 'green', on_route: 'yellow', offline: 'dim',
};

// --- Vehicles ---

export function DemoVehiclesPage() {
  const { toast } = useToast();

  const columns: Column<DemoVehicle>[] = [
    { key: 'name', header: 'Vehicle' },
    { key: 'type', header: 'Type', render: (v) => <Badge color="blue">{v.type.replace('_', ' ')}</Badge> },
    { key: 'licensePlate', header: 'Plate', render: (v) => v.licensePlate || <span style={{ color: C.dim }}>-</span> },
    { key: 'fuelType', header: 'Fuel' },
    { key: 'capacityCount', header: 'Capacity', render: (v) => v.capacityCount ? `${v.capacityCount} pkgs` : '-' },
    {
      key: 'isActive', header: 'Status',
      render: (v) => <Badge color={v.isActive ? 'green' : 'dim'}>{v.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
  ];

  const handleDemoAction = () => {
    toast('This action is disabled in demo mode. Sign up to get started!', 'info');
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 24, margin: 0 }}>Vehicles</h2>
        <button onClick={handleDemoAction} style={{
          padding: '10px 20px', borderRadius: 8, background: C.accent,
          border: 'none', color: '#000', cursor: 'pointer',
          fontFamily: F.body, fontWeight: 600, fontSize: 14,
        }}>
          + Add Vehicle
        </button>
      </div>

      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <DataTable columns={columns} data={DEMO_VEHICLES} />
        <div style={{ padding: 12, textAlign: 'center', color: C.dim, fontSize: 13 }}>
          Showing {DEMO_VEHICLES.length} sample vehicles
        </div>
      </div>
    </div>
  );
}

// --- Drivers ---

export function DemoDriversPage() {
  const { toast } = useToast();

  const columns: Column<DemoDriver>[] = [
    { key: 'name', header: 'Driver' },
    { key: 'email', header: 'Email', render: (d) => d.email || <span style={{ color: C.dim }}>-</span> },
    { key: 'phone', header: 'Phone', render: (d) => d.phone || <span style={{ color: C.dim }}>-</span> },
    { key: 'status', header: 'Status', render: (d) => <Badge color={driverStatusColors[d.status]}>{d.status.replace('_', ' ')}</Badge> },
    {
      key: 'skillTags', header: 'Skills',
      render: (d) => d.skillTags.length > 0
        ? d.skillTags.map(t => <Badge key={t} color="purple">{t.replace('_', ' ')}</Badge>)
        : <span style={{ color: C.dim }}>-</span>,
    },
  ];

  const handleDemoAction = () => {
    toast('This action is disabled in demo mode. Sign up to get started!', 'info');
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 24, margin: 0 }}>Drivers</h2>
        <button onClick={handleDemoAction} style={{
          padding: '10px 20px', borderRadius: 8, background: C.accent,
          border: 'none', color: '#000', cursor: 'pointer',
          fontFamily: F.body, fontWeight: 600, fontSize: 14,
        }}>
          + Add Driver
        </button>
      </div>

      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <DataTable columns={columns} data={DEMO_DRIVERS} />
        <div style={{ padding: 12, textAlign: 'center', color: C.dim, fontSize: 13 }}>
          Showing {DEMO_DRIVERS.length} sample drivers
        </div>
      </div>
    </div>
  );
}
