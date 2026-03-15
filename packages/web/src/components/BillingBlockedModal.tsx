import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, F } from '../theme.js';

export function BillingBlockedModal() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    function handleBlocked(e: CustomEvent) {
      setMessage(e.detail?.message || 'Your subscription has expired or is inactive.');
      setVisible(true);
    }
    window.addEventListener('homer:billing-blocked', handleBlocked as EventListener);
    return () => window.removeEventListener('homer:billing-blocked', handleBlocked as EventListener);
  }, []);

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: C.bg2, borderRadius: 16, border: `1px solid ${C.muted}`, padding: 32, maxWidth: 420, width: '90vw' }}>
        <h3 style={{ fontFamily: F.display, fontSize: 20, marginBottom: 12, color: C.yellow }}>Subscription Required</h3>
        <p style={{ color: C.dim, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={() => setVisible(false)} style={{ padding: '10px 20px', borderRadius: 8, background: C.bg3, border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body }}>Dismiss</button>
          <button onClick={() => { setVisible(false); navigate('/dashboard/settings?tab=billing'); }} style={{ padding: '10px 20px', borderRadius: 8, background: C.accent, border: 'none', color: '#fff', cursor: 'pointer', fontFamily: F.body, fontWeight: 600 }}>Go to Billing</button>
        </div>
      </div>
    </div>
  );
}
