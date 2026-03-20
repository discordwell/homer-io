import { useEffect, useState } from 'react';
import { View, Text, Switch, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
  getBiometricType,
} from '@/services/biometric';
import { C, Size, Spacing, Radius, Base } from '@/theme';

export default function DriverProfileScreen() {
  const router = useRouter();
  const { profile, loadingProfile, fetchProfile, updateStatus } = useDriverStore();
  const { user, logout } = useAuthStore();
  const [toggling, setToggling] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricOn, setBiometricOn] = useState(isBiometricEnabled());
  const [biometricLabel, setBiometricLabel] = useState('Biometric');

  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      setBiometricAvailable(available);
      if (available) {
        const label = await getBiometricType();
        setBiometricLabel(label);
      }
    })();
  }, []);

  useEffect(() => {
    fetchProfile();
  }, []);

  const isOnline = profile?.status !== 'offline';

  const handleToggle = async () => {
    setToggling(true);
    try {
      await updateStatus(isOnline ? 'offline' : 'available');
    } finally {
      setToggling(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  if (loadingProfile && !profile) return <LoadingSpinner />;

  return (
    <SafeAreaView style={Base.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.name || user?.name || 'D')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{profile?.name || user?.name || 'Driver'}</Text>
          <Text style={styles.email}>{profile?.email || user?.email || ''}</Text>
        </View>

        {/* Online/Offline toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Text style={styles.toggleSub}>
              {isOnline ? 'Accepting deliveries' : 'Not accepting deliveries'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggle}
            disabled={toggling}
            trackColor={{ false: C.muted, true: C.green }}
            thumbColor="#fff"
          />
        </View>

        {/* Driver info */}
        <View style={styles.infoCard}>
          {profile?.phone && <InfoRow label="Phone" value={profile.phone} />}
          {profile?.licenseNumber && <InfoRow label="License" value={profile.licenseNumber} />}
          {profile?.currentVehicleId && <InfoRow label="Vehicle" value={profile.currentVehicleId} />}
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
        </View>

        {/* Break button */}
        {isOnline && profile?.status !== 'on_route' && (
          <Pressable
            onPress={() => updateStatus(profile?.status === 'on_break' ? 'available' : 'on_break')}
            style={({ pressed }) => [
              styles.breakBtn,
              { backgroundColor: profile?.status === 'on_break' ? C.green : C.orange },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.breakBtnText}>
              {profile?.status === 'on_break' ? 'End Break' : 'Take a Break'}
            </Text>
          </Pressable>
        )}

        {/* Biometric unlock */}
        {biometricAvailable && (
          <View style={styles.toggleCard}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>{biometricLabel} Unlock</Text>
              <Text style={styles.toggleSub}>
                {biometricOn ? `Unlock with ${biometricLabel}` : 'Use password to unlock'}
              </Text>
            </View>
            <Switch
              value={biometricOn}
              onValueChange={(v) => { setBiometricOn(v); setBiometricEnabled(v); }}
              trackColor={{ false: C.muted, true: C.accent }}
              thumbColor="#fff"
            />
          </View>
        )}

        {/* Sign out */}
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  label: {
    fontSize: Size.sm,
    color: C.dim,
  },
  value: {
    fontSize: Size.md,
    fontWeight: '500',
    color: C.text,
  },
});

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: 16,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: Size.xxl,
    fontWeight: '700',
    color: '#000',
  },
  name: {
    fontSize: Size.xl,
    fontWeight: '700',
    color: C.text,
  },
  email: {
    fontSize: Size.sm,
    color: C.dim,
    marginTop: 4,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bg2,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontWeight: '600',
    fontSize: 15,
    color: C.text,
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: Size.sm,
    color: C.dim,
  },
  infoCard: {
    backgroundColor: C.bg2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  breakBtn: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  breakBtnText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: '#fff',
  },
  signOutBtn: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.red,
    marginTop: 8,
  },
  signOutText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: C.red,
  },
  pressed: {
    opacity: 0.8,
  },
});
