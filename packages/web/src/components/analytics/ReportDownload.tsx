import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/auth.js';
import { useAnalyticsStore } from '../../stores/analytics.js';
import { C, F } from '../../theme.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

type ReportType = 'daily-summary' | 'driver-performance' | 'route-efficiency';

interface ReportOption {
  type: ReportType;
  label: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  { type: 'daily-summary', label: 'Daily Summary' },
  { type: 'driver-performance', label: 'Driver Performance' },
  { type: 'route-efficiency', label: 'Route Efficiency' },
];

export function ReportDownload() {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<ReportType | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { accessToken } = useAuthStore();
  const { range } = useAnalyticsStore();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleDownload = useCallback(function handleDownload(type: ReportType) {
    if (!accessToken) return;
    setDownloading(type);
    setOpen(false);

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const params = new URLSearchParams();

    if (type === 'daily-summary') {
      params.set('date', today);
    } else {
      const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const from = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      params.set('from', from);
      params.set('to', today);
    }

    const url = `${API_BASE}/reports/${type}?${params.toString()}`;

    fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to download report');
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${type}-${today}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => {
        console.error('Report download failed:', err);
      })
      .finally(() => {
        setDownloading(null);
      });
  }, [accessToken, range]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: C.accent,
          color: '#000',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontFamily: F.body,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download Report
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: C.bg2,
            border: `1px solid ${C.muted}`,
            borderRadius: 8,
            overflow: 'hidden',
            minWidth: 200,
            zIndex: 50,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {REPORT_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => handleDownload(option.type)}
              disabled={downloading === option.type}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${C.border}`,
                color: downloading === option.type ? C.dim : C.text,
                fontFamily: F.body,
                fontSize: 13,
                textAlign: 'left',
                cursor: downloading === option.type ? 'wait' : 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = C.bg3;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              {downloading === option.type ? 'Generating...' : option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
