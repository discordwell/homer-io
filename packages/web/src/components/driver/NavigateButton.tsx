import { C, F } from '../../theme.js';

interface NavigateButtonProps {
  lat: number;
  lng: number;
  address: string;
}

function getMapsUrl(lat: number, lng: number, address: string): string {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    // Apple Maps URL scheme
    return `maps://maps.apple.com/?daddr=${encodeURIComponent(address)}&ll=${lat},${lng}`;
  }
  // Google Maps for all other platforms
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(address)}`;
}

export function NavigateButton({ lat, lng, address }: NavigateButtonProps) {
  const handleClick = () => {
    const url = getMapsUrl(lat, lng, address);
    window.open(url, '_blank');
  };

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        padding: '14px 20px',
        background: C.accent,
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        fontSize: 15,
        fontWeight: 600,
        fontFamily: F.body,
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      Navigate
    </button>
  );
}
