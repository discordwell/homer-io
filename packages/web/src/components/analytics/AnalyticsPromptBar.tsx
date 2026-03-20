import { useState } from 'react';
import { C, F, alpha } from '../../theme.js';
import { useNLOpsStore } from '../../stores/nlops.js';

const SUGGESTIONS = [
  'What was my busiest day this week?',
  'Which driver needs improvement?',
  'Compare this week to last week',
  'Why are Tuesday failure rates high?',
];

export function AnalyticsPromptBar() {
  const { setOpen, send } = useNLOpsStore();
  const [input, setInput] = useState('');

  const handleSubmit = (text: string) => {
    const msg = text.trim() || input.trim();
    if (!msg) return;
    setOpen(true);
    send(msg);
    setInput('');
  };

  return (
    <div style={{
      background: `linear-gradient(135deg, ${alpha(C.accent, 0.06)} 0%, ${alpha(C.purple, 0.04)} 100%)`,
      borderRadius: 12, border: `1px solid ${C.muted}`,
      padding: '14px 18px', marginBottom: 20,
    }}>
      {/* Input */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: C.bg, borderRadius: 8, border: `1px solid ${C.muted}`,
          padding: '0 14px',
        }}>
          <span style={{ color: C.accent, fontSize: 14, marginRight: 8 }}>H</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(input)}
            placeholder="Ask HOMER about your analytics..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: C.text, fontFamily: F.body, fontSize: 13, padding: '10px 0',
            }}
          />
        </div>
        <button
          onClick={() => handleSubmit(input)}
          style={{
            padding: '0 18px', borderRadius: 8, background: C.accent,
            border: 'none', color: '#000', cursor: 'pointer',
            fontFamily: F.body, fontSize: 13, fontWeight: 600,
          }}
        >
          Ask
        </button>
      </div>

      {/* Suggestion pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => handleSubmit(s)}
            style={{
              padding: '5px 12px', borderRadius: 20, border: `1px solid ${C.muted}`,
              background: 'transparent', color: C.dim, cursor: 'pointer',
              fontFamily: F.body, fontSize: 11,
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = C.accent;
              e.currentTarget.style.color = C.accent;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = C.muted;
              e.currentTarget.style.color = C.dim;
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
