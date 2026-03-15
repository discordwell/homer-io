import { useRef, useEffect, useCallback, useState } from 'react';
import { C, F } from '../../theme.js';

interface SignaturePadProps {
  onAccept: (base64Png: string) => void;
  onCancel?: () => void;
}

export function SignaturePad({ onAccept, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return ctx;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas resolution to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.text;

    // Fill dark background
    ctx.fillStyle = C.bg3;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw "sign here" baseline
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 30);
    ctx.lineTo(rect.width - 20, rect.height - 30);
    ctx.stroke();

    // Reset stroke style for signature
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 2.5;
  }, []);

  const getCoords = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    drawingRef.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!drawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    drawingRef.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = C.bg3;
    ctx.fillRect(0, 0, rect.width, rect.height);
    // Redraw baseline
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 30);
    ctx.lineTo(rect.width - 20, rect.height - 30);
    ctx.stroke();
    // Reset stroke style
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 2.5;
    setHasDrawn(false);
  };

  const handleAccept = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL('image/png');
    onAccept(base64);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 14, color: C.dim, margin: 0, textAlign: 'center' }}>
        Sign below
      </p>

      <canvas
        ref={canvasRef}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        style={{
          width: '100%',
          height: 200,
          borderRadius: 10,
          border: `1px solid ${C.muted}`,
          touchAction: 'none',
          cursor: 'crosshair',
          background: C.bg3,
        }}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleClear}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'transparent',
            border: `1px solid ${C.muted}`,
            borderRadius: 8,
            color: C.dim,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: F.body,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Clear
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'transparent',
              border: `1px solid ${C.muted}`,
              borderRadius: 8,
              color: C.dim,
              fontSize: 14,
              fontWeight: 500,
              fontFamily: F.body,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleAccept}
          disabled={!hasDrawn}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: hasDrawn ? C.green : C.muted,
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: F.body,
            cursor: hasDrawn ? 'pointer' : 'not-allowed',
            opacity: hasDrawn ? 1 : 0.5,
            minHeight: 44,
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
