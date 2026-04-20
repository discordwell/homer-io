import { useEffect } from 'react';
import { ensureKeyframeStyle } from '../utils/ensureKeyframeStyle.js';
import { C, F } from '../theme.js';

const PULSE_STYLE_ID = 'homer-voice-mic-pulse-keyframes';
const PULSE_CSS = '@keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(255,59,48,0.5); } 70% { box-shadow: 0 0 0 8px rgba(255,59,48,0); } 100% { box-shadow: 0 0 0 0 rgba(255,59,48,0); } }';

interface VoiceMicButtonProps {
  isRecording: boolean;
  isTranscribing: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function VoiceMicButton({ isRecording, isTranscribing, disabled, onClick }: VoiceMicButtonProps) {
  // Inject the @keyframes rule once per document. Idempotent under HMR/SSR
  // (the helper looks for an existing style tag by id before appending).
  useEffect(() => {
    ensureKeyframeStyle(PULSE_STYLE_ID, PULSE_CSS);
  }, []);

  const label = isTranscribing
    ? 'Transcribing...'
    : isRecording
      ? 'Stop recording'
      : 'Voice input';

  return (
    <button
      onClick={onClick}
      disabled={disabled || isTranscribing}
      title={label}
      aria-label={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        border: `1px solid ${isRecording ? '#ff3b30' : C.muted}`,
        background: isRecording ? 'rgba(255,59,48,0.15)' : C.bg,
        color: isRecording ? '#ff3b30' : C.dim,
        cursor: disabled || isTranscribing ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        transition: 'all 0.15s ease',
        animation: isRecording ? 'pulse-ring 1.2s ease infinite' : 'none',
        flexShrink: 0,
      }}
    >
      {isTranscribing ? (
        <span style={{
          display: 'inline-block', width: 14, height: 14,
          border: `2px solid ${C.muted}`, borderTopColor: C.accent,
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
      ) : (
        // Mic SVG icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
    </button>
  );
}
