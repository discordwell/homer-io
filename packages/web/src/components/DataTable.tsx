import { C, F } from '../theme.js';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  pagination?: { page: number; totalPages: number; onPageChange: (page: number) => void };
}

export function DataTable<T extends Record<string, any>>({ columns, data, onRowClick, pagination }: DataTableProps<T>) {
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.body, fontSize: 14 }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={{
                  padding: '10px 12px', textAlign: 'left', color: C.dim, fontSize: 12,
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                  borderBottom: `1px solid ${C.muted}`, whiteSpace: 'nowrap',
                  width: col.width,
                }}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ padding: 32, textAlign: 'center', color: C.dim }}>No data</td></tr>
            ) : data.map((item, i) => (
              <tr key={(item as any).id || i}
                onClick={() => onRowClick?.(item)}
                style={{ cursor: onRowClick ? 'pointer' : 'default', borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg3)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {columns.map(col => (
                  <td key={col.key} style={{ padding: '10px 12px', color: C.text }}>
                    {col.render ? col.render(item) : String(item[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => pagination.onPageChange(pagination.page - 1)} disabled={pagination.page <= 1}
            style={pgBtnStyle(false)}>Prev</button>
          <span style={{ color: C.dim, fontSize: 13, padding: '6px 12px' }}>
            {pagination.page} / {pagination.totalPages}
          </span>
          <button onClick={() => pagination.onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
            style={pgBtnStyle(false)}>Next</button>
        </div>
      )}
    </div>
  );
}

function pgBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 6, fontSize: 13,
    background: C.bg3, border: `1px solid ${C.muted}`, color: C.dim,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: F.body,
    opacity: disabled ? 0.5 : 1,
  };
}
