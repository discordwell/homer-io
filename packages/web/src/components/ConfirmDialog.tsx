import { Modal } from './Modal.js';
import { C, F } from '../theme.js';

interface ConfirmDialogProps {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmLabel?: string; variant?: 'danger' | 'normal';
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', variant = 'danger' }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p style={{ color: C.dim, fontSize: 14, marginBottom: 24 }}>{message}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          padding: '8px 20px', borderRadius: 8, background: C.bg3,
          border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body,
        }}>Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} style={{
          padding: '8px 20px', borderRadius: 8,
          background: variant === 'danger' ? C.red : C.accent,
          border: 'none', color: '#fff', cursor: 'pointer', fontFamily: F.body, fontWeight: 600,
        }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
