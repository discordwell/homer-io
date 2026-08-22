import { useRef } from 'react';
import { useThemeStore, THEME_CYCLE, type ThemeMode } from '../stores/theme.js';
import { C, F, alpha } from '../theme.js';

const LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const DESCRIPTIONS: Record<ThemeMode, string> = {
  light: 'Always use the light palette',
  dark: 'Always use the dark palette',
  system: 'Follow your device setting',
};

function Icon({ mode, size = 16 }: { mode: ThemeMode; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (mode === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
      </svg>
    );
  }
  if (mode === 'dark') {
    return (
      <svg {...common}>
        <path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.9 6.9 0 0 0 11.1 11.1Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2.8" y="4.2" width="18.4" height="12.4" rx="1.8" />
      <path d="M8.5 20.2h7M12 16.6v3.6" />
    </svg>
  );
}

/**
 * Compact nav toggle — one button that cycles Light → Dark → System.
 *
 * Shows the icon for the *selected mode*, not the resolved one, so "System"
 * stays visibly distinct from whichever palette it currently resolves to.
 */
export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const mode = useThemeStore((s) => s.mode);
  const cycleMode = useThemeStore((s) => s.cycleMode);

  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(mode) + 1) % THEME_CYCLE.length];
  const size = compact ? 30 : 34;

  return (
    <button
      type="button"
      className={className}
      onClick={cycleMode}
      title={`Theme: ${LABELS[mode]} — switch to ${LABELS[next]}`}
      aria-label={`Theme: ${LABELS[mode]}. Activate to switch to ${LABELS[next]}.`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        background: 'transparent',
        color: C.dim,
        cursor: 'pointer',
        padding: 0,
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = C.text;
        e.currentTarget.style.background = C.bg3;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = C.dim;
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <Icon mode={mode} size={compact ? 15 : 17} />
    </button>
  );
}

/**
 * Three-way segmented control for Settings.
 *
 * radiogroup rather than a row of buttons: this is one exclusive choice, so a
 * screen reader should announce it as "2 of 3", not as three unrelated
 * buttons. The role alone confers no behaviour, so the roving tabIndex and
 * arrow-key handling below are what actually make it behave like a radio
 * group — one tab stop, arrows to move, Home/End to jump.
 */
export function ThemeModeSelector() {
  const mode = useThemeStore((s) => s.mode);
  const resolved = useThemeStore((s) => s.resolved);
  const setMode = useThemeStore((s) => s.setMode);
  const groupRef = useRef<HTMLDivElement>(null);

  /** Move selection and focus together, the way native radios do. */
  const focusOption = (index: number) => {
    const next = THEME_CYCLE[(index + THEME_CYCLE.length) % THEME_CYCLE.length];
    setMode(next);
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[THEME_CYCLE.indexOf(next)]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = THEME_CYCLE.indexOf(mode);
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusOption(current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusOption(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        focusOption(THEME_CYCLE.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Color theme"
        onKeyDown={handleKeyDown}
        style={{
          display: 'inline-flex',
          gap: 4,
          padding: 4,
          borderRadius: 10,
          background: C.bg3,
          border: `1px solid ${C.border}`,
        }}
      >
        {THEME_CYCLE.map((option) => {
          const selected = mode === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              // Roving tabIndex: the group is a single tab stop; arrows move
              // within it. Without this all three land in the tab order and
              // the widget stops matching what the role announces.
              tabIndex={selected ? 0 : -1}
              onClick={() => setMode(option)}
              title={DESCRIPTIONS[option]}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 7,
                border: '1px solid',
                borderColor: selected ? alpha(C.accent, 0.35) : 'transparent',
                background: selected ? alpha(C.accent, 0.14) : 'transparent',
                color: selected ? C.accentText : C.dim,
                fontFamily: F.body,
                fontSize: 13,
                fontWeight: selected ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Icon mode={option} size={15} />
              {LABELS[option]}
            </button>
          );
        })}
      </div>
      <p style={{ color: C.muted, fontSize: 12, marginTop: 10, marginBottom: 0, fontFamily: F.body }}>
        {mode === 'system'
          ? `Following your device setting — currently ${LABELS[resolved].toLowerCase()}.`
          : DESCRIPTIONS[mode]}
      </p>
    </div>
  );
}
