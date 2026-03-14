import { DataTable, type Column } from '../DataTable.js';
import { C, F } from '../../theme.js';
import type { DriverPerformance } from '@homer-io/shared';

interface DriverLeaderboardProps {
  drivers: DriverPerformance[];
}

function rateColor(rate: number): string {
  if (rate > 90) return C.green;
  if (rate > 75) return C.yellow;
  return C.red;
}

export function DriverLeaderboard({ drivers }: DriverLeaderboardProps) {
  const ranked = drivers.map((d, i) => ({ ...d, rank: i + 1 }));

  const columns: Column<typeof ranked[number]>[] = [
    { key: 'rank', header: 'Rank', width: 60 },
    { key: 'driverName', header: 'Driver' },
    { key: 'totalDeliveries', header: 'Deliveries', width: 100 },
    {
      key: 'successRate', header: 'Success Rate', width: 120,
      render: (d) => (
        <span style={{ color: rateColor(d.successRate), fontWeight: 600 }}>
          {d.successRate}%
        </span>
      ),
    },
    {
      key: 'avgDeliveryTime', header: 'Avg Time', width: 100,
      render: (d) => (
        <span style={{ fontFamily: F.mono, fontSize: 13 }}>
          {d.avgDeliveryTime != null ? `${d.avgDeliveryTime}m` : '\u2014'}
        </span>
      ),
    },
  ];

  return (
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16,
    }}>
      <h3 style={{ fontFamily: F.display, fontSize: 16, margin: '0 0 16px 0', color: C.text }}>
        Driver Leaderboard
      </h3>
      <DataTable columns={columns} data={ranked} />
    </div>
  );
}
