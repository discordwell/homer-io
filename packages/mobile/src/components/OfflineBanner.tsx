import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { C, Size, Spacing } from '@/theme';

export function OfflineBanner() {
  const isConnected = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No internet connection — changes will sync when reconnected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: C.orange,
    paddingVertical: 6,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  text: {
    color: '#000',
    fontSize: Size.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
});
