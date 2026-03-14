import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { C, F } from '../theme.js';

interface ModalProps {
  open: boolean; onClose: () => void; title: string;
  size?: 'sm' | 'md' | 'lg'; children: React.ReactNode;
}

const sizes = { sm: 400, md: 560, lg: 720 };

export function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)',
      }}>
      <div style={{
        background: C.bg2, borderRadius: 16, border: `1px solid ${C.muted}`,
        width: sizes[size], maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto',
        padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: F.display, fontSize: 18, margin: 0, color: C.text }}>{title}</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.dim, cursor: 'pointer',
            fontSize: 20, padding: 4, lineHeight: 1,
          }}>&times;</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
