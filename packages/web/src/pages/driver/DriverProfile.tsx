import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverStore } from '../../stores/driver.js';
import { useAuthStore } from '../../stores/auth.js';
import { LoadingSpinner } from '../../components/LoadingSpinner.js';
import { C, F } from '../../theme.js';

export function DriverProfilePage() {
  const navigate = useNavigate();
  const { profile, loadingProfile, fetchProfile, updateStatus } = useDriverStore();
  const { user, logout } = useAuthStore();
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const isOnline = profile?.status !== 'offline';

  const handleToggle = async () => {
    setToggling(true);
    try {
      await updateStatus(isOnline ? 'offline' : 'available');
    } finally {
      setToggling(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  if (loadingProfile && !profile) return <LoadingSpinner />;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', paddingTop: 12 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: C.accent, margin: '0 auto 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 700, color: '#fff',
        }}>
          {(profile?.name || user?.name || 'D')[0].toUpperCase()}
        </div>
        <h2 style={{ fontFamily: F.display, fontSize: 20, margin: '0 0 4px', color: C.text }}>
          {profile?.name || user?.name || 'Driver'}
        </h2>
        <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>
          {profile?.email || user?.email || ''}
        </p>
      </div>

      {/* Online/Offline toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: C.bg2, borderRadius: 12, padding: '16px 20px',
        border: `1px solid ${C.border}`,
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <div style={{ fontSize: 12, color: C.dim }}>
            {isOnline ? 'Accepting deliveries' : 'Not accepting deliveries'}
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          style={{
            position: 'relative',
            width: 52,
            height: 28,
            borderRadius: 14,
            background: isOnline ? C.green : C.muted,
            border: 'none',
            cursor: toggling ? 'wait' : 'pointer',
            transition: 'background 0.2s',
            minWidth: 44,
            minHeight: 28,
            padding: 0,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 2,
            left: isOnline ? 26 : 2,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      </div>

      {/* Driver info */}
      <div style={{
        background: C.bg2, borderRadius: 12,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}>
        {profile?.phone && (
          <InfoRow label="Phone" value={profile.phone} />
        )}
        {profile?.licenseNumber && (
          <InfoRow label="License" value={profile.licenseNumber} />
        )}
        {profile?.currentVehicleId && (
          <InfoRow label="Vehicle" value={profile.currentVehicleId} />
        )}
        <InfoRow
          label="Status"
          value={profile?.status || 'unknown'}
          valueColor={
            profile?.status === 'available' ? C.green :
            profile?.status === 'on_route' ? C.yellow :
            profile?.status === 'on_break' ? C.orange :
            C.dim
          }
        />
      </div>

      {/* On Break button */}
      {isOnline && profile?.status !== 'on_route' && (
        <button
          onClick={() => updateStatus(profile?.status === 'on_break' ? 'available' : 'on_break')}
          style={{
            padding: '14px 20px',
            background: profile?.status === 'on_break' ? C.green : C.orange,
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: F.body,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          {profile?.status === 'on_break' ? 'End Break' : 'Take a Break'}
        </button>
      )}

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        style={{
          padding: '14px 20px',
          background: 'transparent',
          border: `1px solid ${C.red}`,
          borderRadius: 10,
          color: C.red,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: F.body,
          cursor: 'pointer',
          minHeight: 44,
          marginTop: 8,
        }}
      >
        Sign Out
      </button>
    </div>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 20px',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 13, color: C.dim }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: valueColor || C.text }}>{value}</span>
    </div>
  );
}
