import React, { cloneElement, isValidElement, useId } from 'react';
import { C, F } from '../theme.js';

interface FormFieldProps {
  label: string; error?: string; children?: React.ReactNode;
  type?: string; value?: string | number; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; required?: boolean; min?: number; step?: string;
  id?: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 8,
  background: C.bg, border: `1px solid ${C.muted}`,
  color: C.text, fontSize: 14, outline: 'none',
  fontFamily: F.body, boxSizing: 'border-box',
};

// Tag names for which we automatically wire an explicit `id` so that the
// wrapping label's `htmlFor` always matches. This keeps the label associated
// with the input even when consumers pass arbitrary children (select/textarea/etc).
const WIRABLE_TAGS = new Set(['input', 'select', 'textarea']);

export function FormField({ label, error, children, type = 'text', value, onChange, placeholder, required, min, step, id }: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  let renderedChild: React.ReactNode;
  if (children !== undefined && children !== null) {
    // If the child is a recognized form element without its own id, inject one.
    // For other children (custom widgets) we still set htmlFor — consumers that
    // need strict programmatic association can pass an explicit `id` prop.
    if (isValidElement(children) && typeof children.type === 'string' && WIRABLE_TAGS.has(children.type)) {
      const existingId = (children.props as { id?: string }).id;
      renderedChild = existingId
        ? children
        : cloneElement(children as React.ReactElement<{ id?: string }>, { id: fieldId });
    } else {
      renderedChild = children;
    }
  } else {
    renderedChild = (
      <input id={fieldId} type={type} value={value} onChange={onChange} placeholder={placeholder}
        required={required} min={min} step={step} style={inputStyle} />
    );
  }

  return (
    <label htmlFor={fieldId} style={{ display: 'block', marginBottom: 16 }}>
      <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>{label}{required && ' *'}</span>
      {renderedChild}
      {error && <span style={{ color: C.red, fontSize: 12, marginTop: 4, display: 'block' }}>{error}</span>}
    </label>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { inputStyle };
