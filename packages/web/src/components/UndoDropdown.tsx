import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { C, F } from '../theme.js';

interface UndoableAction {
  snapshotId: string;
  toolName: string;
  summary: string;
  timestamp: number;
}

const TOOL_LABELS: Record<string, string> = {
  assign_order_to_route: 'Assigned orders',
  update_order_status: 'Status change',
  change_driver_status: 'Driver status',
  create_route: 'Created route',
  reassign_orders: 'Reassigned orders',
  optimize_route: 'Optimized route',
  transition_route_status: 'Route transition',
};

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

interface UndoDropdownProps {
  /** Actions received via SSE undoable events */
  undoableActions: UndoableAction[];
  onUndo: (snapshotId: string) => Promise<void>;
}

export function UndoDropdown({ undoableActions, onUndo }: UndoDropdownProps) {
  const [open, setOpen] = useState(false);
  const [serverActions, setServerActions] = useState<UndoableAction[]>([]);
  const [undoing, setUndoing] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Merge SSE-received actions with server-fetched actions (dedupe by snapshotId)
  const allActions = [...undoableActions];
  for (const sa of serverActions) {
    if (!allActions.find((a) => a.snapshotId === sa.snapshotId)) {
      allActions.push(sa);
    }
  }
  // Sort by timestamp descending
  allActions.sort((a, b) => b.timestamp - a.timestamp);

  // Fetch from server when opening
  useEffect(() => {
    if (open) {
      api.get<{ items: UndoableAction[] }>('/ai/undo/recent')
        .then((res) => setServerActions(res.items))
        .catch(() => {});
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleUndo(snapshotId: string) {
    setUndoing(snapshotId);
    try {
      await onUndo(snapshotId);
      // Remove from local list on success
      setServerActions((prev) => prev.filter((a) => a.snapshotId !== snapshotId));
    } finally {
      setUndoing(null);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Undo recent actions"
        style={{
          background: open ? C.accent : 'none',
          border: `1px solid ${open ? C.accent : C.muted}`,
          color: open ? '#000' : C.dim,
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Undo arrow SVG */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.69 3L3 13" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          width: 280, background: C.bg2, border: `1px solid ${C.muted}`,
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 1000, overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: `1px solid ${C.border}`,
            fontSize: 12, fontFamily: F.display, fontWeight: 600, color: C.dim,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            Recent Actions
          </div>

          {allActions.length === 0 && (
            <div style={{ padding: '16px 12px', fontSize: 13, color: C.dim, textAlign: 'center' }}>
              No undoable actions
            </div>
          )}

          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {allActions.map((action) => (
              <div
                key={action.snapshotId}
                style={{
                  padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 13,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontWeight: 500 }}>
                    {TOOL_LABELS[action.toolName] || action.toolName}
                  </div>
                  <div style={{ color: C.dim, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {action.summary} — {timeAgo(action.timestamp)}
                  </div>
                </div>
                <button
                  onClick={() => handleUndo(action.snapshotId)}
                  disabled={undoing === action.snapshotId}
                  style={{
                    padding: '4px 10px', borderRadius: 4,
                    background: 'none', border: `1px solid ${C.orange}`,
                    color: C.orange, cursor: 'pointer', fontSize: 12,
                    fontFamily: F.body, opacity: undoing === action.snapshotId ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  {undoing === action.snapshotId ? '...' : 'Undo'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
