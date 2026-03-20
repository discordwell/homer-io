import { useEffect, useState } from 'react';
import { View, Text, Switch, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
  getBiometricType,
} from '@/services/biometric';
import { C, Size, Spacing, Radius, Base } from '@/theme';

export default function DispatcherProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [biometricAvailable, setBiometricAvailableState] = useState(false);
  const [biometricOn, setBiometricOn] = useState(isBiometricEnabled());
  const [biometricLabel, setBiometricLabel] = useState('Biometric');

  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      setBiometricAvailableState(available);
      if (available) setBiometricLabel(await getBiometricType());
    })();
  }, []);

  const handleSignOut = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.role}>{user?.role || 'Dispatcher'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
        </View>

        {/* Biometric */}
        {biometricAvailable && (
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>{biometricLabel} Unlock</Text>
              <Text style={styles.settingHint}>Require {biometricLabel.toLowerCase()} to open the app</Text>
            </View>
            <Switch
              value={biometricOn}
              onValueChange={(v) => { setBiometricOn(v); setBiometricEnabled(v); }}
              trackColor={{ false: C.muted, true: C.accent }}
              thumbColor="#fff"
            />
          </View>
        )}

        {/* Web app link */}
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Full Settings</Text>
            <Text style={styles.settingHint}>Team, billing, integrations, and more are available on the web</Text>
          </View>
          <Text style={styles.webLink}>app.homer.io</Text>
        </View>

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

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: 16 },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: Size.xxl, fontWeight: '700', color: '#000' },
  name: { fontSize: Size.xl, fontWeight: '700', color: C.text },
  role: { fontSize: Size.md, color: C.accent, textTransform: 'capitalize', marginTop: 2 },
  email: { fontSize: Size.sm, color: C.dim, marginTop: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg2, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: C.border },
  settingLabel: { fontSize: Size.md, fontWeight: '600', color: C.text },
  settingHint: { fontSize: Size.sm, color: C.dim, marginTop: 2 },
  webLink: { color: C.accent, fontSize: Size.sm, fontWeight: '500' },
  signOutBtn: { paddingVertical: 14, borderRadius: Radius.lg, alignItems: 'center', borderWidth: 1, borderColor: C.red, marginTop: 8 },
  signOutText: { fontSize: Size.md, fontWeight: '600', color: C.red },
  pressed: { opacity: 0.8 },
});
