import { useRef } from 'react';
import { C, F } from '../../theme.js';

interface PhotoCaptureProps {
  photos: File[];
  onChange: (photos: File[]) => void;
  maxPhotos?: number;
}

export function PhotoCapture({ photos, onChange, maxPhotos = 4 }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos = [...photos];
    for (let i = 0; i < files.length; i++) {
      if (newPhotos.length >= maxPhotos) break;
      newPhotos.push(files[i]);
    }
    onChange(newPhotos);

    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onChange(newPhotos);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Photo grid */}
      {photos.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
        }}>
          {photos.map((photo, i) => (
            <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <img
                src={URL.createObjectURL(photo)}
                alt={`Photo ${i + 1}`}
                style={{
                  width: '100%',
                  height: 120,
                  objectFit: 'cover',
                  display: 'block',
                  borderRadius: 8,
                  border: `1px solid ${C.muted}`,
                }}
              />
              <button
                onClick={() => removePhoto(i)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)',
                  border: 'none',
                  color: C.red,
                  fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add photo button */}
      {photos.length < maxPhotos && (
        <button
          onClick={() => inputRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '16px',
            background: C.bg3,
            border: `1px dashed ${C.muted}`,
            borderRadius: 10,
            color: C.dim,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: F.body,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Take Photo ({photos.length}/{maxPhotos})
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        style={{ display: 'none' }}
      />
    </div>
  );
}
