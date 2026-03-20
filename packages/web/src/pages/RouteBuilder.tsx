import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoutesStore } from '../stores/routes.js';
import { useFleetStore } from '../stores/fleet.js';
import { useOrdersStore } from '../stores/orders.js';
import { RouteMap } from '../components/RouteMap.js';
import { FormField } from '../components/FormField.js';
import { SelectField } from '../components/SelectField.js';
import { KPICard } from '../components/KPICard.js';
import { useToast } from '../components/Toast.js';
import { C, F, primaryBtnStyle, secondaryBtnStyle } from '../theme.js';

interface Stop {
  lat: number;
  lng: number;
  label: string;
  orderId?: string;
}

export function RouteBuilderPage() {
  const navigate = useNavigate();
  const { createRoute } = useRoutesStore();
  const { vehicles, drivers, fetchVehicles, fetchDrivers } = useFleetStore();
  const { orders, fetchOrders } = useOrdersStore();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    fetchVehicles(1);
    fetchDrivers(1);
    fetchOrders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Available orders (not already assigned to a route)
  const availableOrders = orders.filter(o => !o.routeId && o.status === 'received');

  function addOrderAsStop(orderId: string) {
    const order = orders.find(o => o.id === orderId);
    if (!order || selectedOrders.includes(orderId)) return;

    // Use real coordinates if available, otherwise generate approximate ones
    const orderRec = order as unknown as Record<string, unknown>;
    const lat = orderRec.deliveryLat ? Number(orderRec.deliveryLat) : 40.7128 + (Math.random() - 0.5) * 0.1;
    const lng = orderRec.deliveryLng ? Number(orderRec.deliveryLng) : -74.006 + (Math.random() - 0.5) * 0.1;

    setStops(prev => [...prev, {
      lat, lng,
      label: order.recipientName,
      orderId: order.id,
    }]);
    setSelectedOrders(prev => [...prev, orderId]);
  }

  function addMapStop(lat: number, lng: number) {
    setStops(prev => [...prev, {
      lat, lng,
      label: `Stop ${prev.length + 1}`,
    }]);
  }

  function removeStop(index: number) {
    const stop = stops[index];
    if (stop.orderId) {
      setSelectedOrders(prev => prev.filter(id => id !== stop.orderId));
    }
    setStops(prev => prev.filter((_, i) => i !== index));
  }

  function moveStop(from: number, to: number) {
    if (to < 0 || to >= stops.length) return;
    const newStops = [...stops];
    const [moved] = newStops.splice(from, 1);
    newStops.splice(to, 0, moved);
    setStops(newStops);
  }

  async function handleSave() {
    if (!name.trim()) { toast('Route name is required', 'error'); return; }
    if (stops.length === 0) { toast('Add at least one stop', 'error'); return; }

    setSaving(true);
    try {
      const route = await createRoute({
        name: name.trim(),
        driverId: driverId || undefined,
        vehicleId: vehicleId || undefined,
        orderIds: selectedOrders.length > 0 ? selectedOrders : undefined,
      });
      toast('Route created!', 'success');
      navigate(`/dashboard/routes/${route.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create route', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleOptimize() {
    if (stops.length < 2) { toast('Need at least 2 stops to optimize', 'error'); return; }
    setOptimizing(true);
    toast('AI optimization requires a saved route. Save first, then optimize from the route detail page.', 'info');
    setOptimizing(false);
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Route Builder</h2>
          <p style={{ color: C.dim, fontSize: 14 }}>Click the map or add orders to build a route</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/dashboard/routes')} style={cancelBtnStyle}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
            {saving ? 'Saving...' : 'Save Route'}
          </button>
        </div>
      </div>

      <div className="route-builder-grid" style={{ display: 'grid', gap: 24 }}>
        {/* Left: Map */}
        <div>
          <RouteMap stops={stops} onClick={addMapStop} height="500px" />
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 20 }}>
            <FormField label="Route Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Downtown Morning Route" />
            <SelectField label="Driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}
              options={[{ value: '', label: 'Unassigned' }, ...drivers.map(d => ({ value: d.id, label: d.name }))]} />
            <SelectField label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
              options={[{ value: '', label: 'Unassigned' }, ...vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.type})` }))]} />
          </div>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KPICard icon="📍" label="Stops" value={stops.length} color={C.accent} />
            <KPICard icon="📦" label="Orders" value={selectedOrders.length} color={C.green} />
          </div>

          {/* Stop list */}
          <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16, flex: 1, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Stops</span>
              <button onClick={handleOptimize} disabled={optimizing || stops.length < 2}
                style={{ ...secondaryBtnStyle, fontSize: 12, padding: '6px 12px' }}>
                🤖 AI Optimize
              </button>
            </div>

            {stops.length === 0 ? (
              <p style={{ color: C.dim, fontSize: 13, textAlign: 'center', padding: 16 }}>
                Click the map or select orders below to add stops
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {stops.map((stop, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: C.bg3, borderRadius: 6, fontSize: 13,
                  }}>
                    <span style={{ color: C.accent, fontWeight: 600, width: 20 }}>{i + 1}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stop.label}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => moveStop(i, i - 1)} disabled={i === 0}
                        style={moveBtnStyle}>↑</button>
                      <button onClick={() => moveStop(i, i + 1)} disabled={i === stops.length - 1}
                        style={moveBtnStyle}>↓</button>
                      <button onClick={() => removeStop(i)}
                        style={{ ...moveBtnStyle, color: C.red }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available orders */}
          {availableOrders.length > 0 && (
            <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16, maxHeight: 200, overflow: 'auto' }}>
              <span style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, display: 'block' }}>Available Orders</span>
              {availableOrders.map(o => (
                <div key={o.id} onClick={() => addOrderAsStop(o.id)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                    color: selectedOrders.includes(o.id) ? C.dim : C.text,
                    background: selectedOrders.includes(o.id) ? 'transparent' : C.bg3,
                    marginBottom: 4, opacity: selectedOrders.includes(o.id) ? 0.5 : 1,
                  }}>
                  {o.recipientName} — {o.deliveryAddress.street}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body,
};

const moveBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: C.dim, cursor: 'pointer',
  fontSize: 14, padding: '0 4px', fontFamily: F.body,
};
