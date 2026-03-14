import { C, F } from '../theme.js';

interface SelectFieldProps {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>; required?: boolean;
}

export function SelectField({ label, value, onChange, options, required }: SelectFieldProps) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>{label}{required && ' *'}</span>
      <select value={value} onChange={onChange} required={required} style={{
        width: '100%', padding: 12, borderRadius: 8,
        background: C.bg, border: `1px solid ${C.muted}`,
        color: C.text, fontSize: 14, outline: 'none',
        fontFamily: F.body, boxSizing: 'border-box',
        appearance: 'none', cursor: 'pointer',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236888AA' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
