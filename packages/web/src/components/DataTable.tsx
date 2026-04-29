import { C, F } from '../theme.js';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T) => React.ReactNode;
  width?: string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  pagination?: { page: number; totalPages: number; onPageChange: (page: number) => void };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({ columns, data, onRowClick, pagination }: DataTableProps<T>) {
  const minWidth = Math.max(columns.reduce((sum, column) => sum + getColumnMinWidth(column), 0), 520);

  return (
    <div>
      <div className="data-table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.body, fontSize: 14, minWidth }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={{
                  padding: '10px 12px', textAlign: 'left', color: C.dim, fontSize: 12,
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                  borderBottom: `1px solid ${C.muted}`, whiteSpace: 'nowrap',
                  width: col.width, position: 'sticky', top: 0, background: C.bg2, zIndex: 1,
                }}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ padding: 32, textAlign: 'center', color: C.dim }}>No data</td></tr>
            ) : data.map((item, i) => (
              <tr key={(item as Record<string, unknown>).id as string || i}
                onClick={() => onRowClick?.(item)}
                style={{ cursor: onRowClick ? 'pointer' : 'default', borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg3)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {columns.map(col => (
                  <td key={col.key} style={{ padding: '10px 12px', color: C.text, whiteSpace: col.width ? 'nowrap' : undefined, verticalAlign: 'top' }}>
                    {col.render ? col.render(item) : String(item[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="data-table-pagination" style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => pagination.onPageChange(pagination.page - 1)} disabled={pagination.page <= 1}
            style={pgBtnStyle(pagination.page <= 1)}>Prev</button>
          <span style={{ color: C.dim, fontSize: 13, padding: '6px 12px', display: 'flex', alignItems: 'center' }}>
            {pagination.page} / {pagination.totalPages}
          </span>
          <button onClick={() => pagination.onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
            style={pgBtnStyle(pagination.page >= pagination.totalPages)}>Next</button>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getColumnMinWidth<T extends Record<string, any>>(column: Column<T>): number {
  if (typeof column.width === 'number') return column.width;
  if (typeof column.width === 'string') {
    const parsed = Number.parseInt(column.width, 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  const headerText = typeof column.header === 'string'
    ? column.header.toLowerCase()
    : '';

  if (column.key === 'select' || column.key === 'actions') return 52;
  if (column.key.includes('address') || headerText.includes('address')) return 180;
  if (column.key.includes('name') || headerText.includes('recipient') || headerText.includes('route')) return 160;
  if (headerText.includes('status') || headerText.includes('priority') || headerText.includes('progress')) return 120;
  if (headerText.includes('created') || headerText.includes('date')) return 110;

  return 96;
}

function pgBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 6, fontSize: 13,
    background: C.bg3, border: `1px solid ${C.muted}`, color: C.dim,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: F.body,
    opacity: disabled ? 0.5 : 1,
  };
}
