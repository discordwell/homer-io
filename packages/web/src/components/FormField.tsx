import { C, F } from '../theme.js';

interface FormFieldProps {
  label: string; error?: string; children?: React.ReactNode;
  type?: string; value?: string | number; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; required?: boolean; min?: number; step?: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 8,
  background: C.bg, border: `1px solid ${C.muted}`,
  color: C.text, fontSize: 14, outline: 'none',
  fontFamily: F.body, boxSizing: 'border-box',
};

export function FormField({ label, error, children, type = 'text', value, onChange, placeholder, required, min, step }: FormFieldProps) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>{label}{required && ' *'}</span>
      {children || (
        <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          required={required} min={min} step={step} style={inputStyle} />
      )}
      {error && <span style={{ color: C.red, fontSize: 12, marginTop: 4, display: 'block' }}>{error}</span>}
    </label>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { inputStyle };
