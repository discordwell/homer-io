import { useState, useEffect } from 'react';
import { C, F, alpha } from '../../theme.js';
import { KPICard } from '../KPICard.js';

interface CarbonOverview {
  totalCo2Kg: number;
  totalDistanceKm: number;
  routeCount: number;
  evSavingsKg: number;
  greenDeliveryPercent: number;
  avgCo2PerRouteKg: number;
}

interface CarbonByDriver {
  driverId: string;
  driverName: string;
  totalCo2Kg: number;
  totalDistanceKm: number;
  routeCount: number;
}

interface CarbonData {
  overview: CarbonOverview;
  drivers: CarbonByDriver[];
}

interface CarbonDashboardProps {
  range: '7d' | '30d' | '90d';
}

export function CarbonDashboard({ range }: CarbonDashboardProps) {
  const [data, setData] = useState<CarbonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settledRange, setSettledRange] = useState<string | null>(null);
  const loading = settledRange !== range;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/analytics/carbon?range=${range}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch carbon data');
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setSettledRange(range);
      });

    return () => { cancelled = true; };
  }, [range]);

  if (loading) {
    return (
      <div style={{ color: C.dim, padding: 40, textAlign: 'center', fontFamily: F.body }}>
        Loading carbon data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ color: C.red, padding: 40, textAlign: 'center', fontFamily: F.body }}>
        {error || 'No data available'}
      </div>
    );
  }

  const { overview, drivers } = data;
  const maxCo2 = drivers.length > 0 ? Math.max(...drivers.map((d) => d.totalCo2Kg)) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <KPICard
          icon="\u{1F4A8}"
          label="Total CO2"
          value={`${overview.totalCo2Kg.toLocaleString()} kg`}
          sub={`${overview.routeCount} routes`}
          color={C.orange}
        />
        <KPICard
          icon="\u{1F50B}"
          label="EV Savings"
          value={`${overview.evSavingsKg.toLocaleString()} kg`}
          sub="CO2 avoided by electric vehicles"
          color={C.green}
        />
        <KPICard
          icon="\u{1F33F}"
          label="Green Deliveries"
          value={`${overview.greenDeliveryPercent}%`}
          sub="Zero-emission routes"
          color={C.green}
        />
        <KPICard
          icon="\u{1F4CA}"
          label="Avg CO2 / Route"
          value={`${overview.avgCo2PerRouteKg} kg`}
          sub={`${overview.totalDistanceKm.toLocaleString()} km total`}
          color={C.accent}
        />
      </div>

      {/* Per-driver CO2 breakdown */}
      <div style={{
        background: C.bg2,
        borderRadius: 12,
        border: `1px solid ${C.muted}`,
        padding: 20,
      }}>
        <h3 style={{
          fontFamily: F.display,
          fontSize: 16,
          margin: '0 0 20px 0',
          color: C.text,
        }}>
          CO2 Emissions by Driver
        </h3>

        {drivers.length === 0 ? (
          <div style={{ color: C.dim, fontSize: 14, fontFamily: F.body, textAlign: 'center', padding: 20 }}>
            No driver data for this period
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {drivers.map((driver) => (
              <div key={driver.driverId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 140,
                  flexShrink: 0,
                  fontSize: 13,
                  fontFamily: F.body,
                  color: C.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {driver.driverName}
                </div>

                <div style={{ flex: 1, height: 20, borderRadius: 4, background: C.muted, overflow: 'hidden' }}>
                  <div style={{
                    width: `${maxCo2 > 0 ? (driver.totalCo2Kg / maxCo2) * 100 : 0}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: driver.totalCo2Kg === 0
                      ? C.green
                      : driver.totalCo2Kg < overview.avgCo2PerRouteKg
                        ? C.accent
                        : C.orange,
                    transition: 'width 0.5s ease',
                    minWidth: driver.totalCo2Kg > 0 ? 4 : 0,
                  }} />
                </div>

                <div style={{
                  width: 80,
                  flexShrink: 0,
                  textAlign: 'right',
                  fontSize: 13,
                  fontFamily: F.mono,
                  color: C.dim,
                }}>
                  {driver.totalCo2Kg} kg
                </div>

                <div style={{
                  width: 60,
                  flexShrink: 0,
                  textAlign: 'right',
                  fontSize: 11,
                  fontFamily: F.body,
                  color: C.dim,
                }}>
                  {driver.routeCount} rts
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trend comparison hint */}
      {overview.routeCount > 0 && overview.evSavingsKg > 0 && (
        <div style={{
          background: alpha(C.green, 0.04),
          borderRadius: 12,
          border: `1px solid ${alpha(C.green, 0.15)}`,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>{'\u{2705}'}</span>
          <div>
            <div style={{ fontFamily: F.body, fontSize: 14, color: C.text }}>
              Your EV fleet saved {overview.evSavingsKg.toLocaleString()} kg CO2 this period
            </div>
            <div style={{ fontFamily: F.body, fontSize: 12, color: C.dim, marginTop: 2 }}>
              Equivalent to {Math.round(overview.evSavingsKg / 21.7)} trees absorbing CO2 for a year
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
