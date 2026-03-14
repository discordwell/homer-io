import { C } from '../theme.js';

interface LoadingSpinnerProps { size?: number; }

export function LoadingSpinner({ size = 32 }: LoadingSpinnerProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
    }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: `3px solid ${C.muted}`, borderTopColor: C.accent,
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
