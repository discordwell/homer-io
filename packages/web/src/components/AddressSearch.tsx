import { useState } from 'react';
import { C, F } from '../theme.js';

interface AddressSearchProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
}

export function AddressSearch({ value, onChange, placeholder = 'Enter address...' }: AddressSearchProps) {
  return (
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: 12, borderRadius: 8,
        background: C.bg, border: `1px solid ${C.muted}`,
        color: C.text, fontSize: 14, outline: 'none',
        fontFamily: F.body, boxSizing: 'border-box',
      }}
    />
  );
}
