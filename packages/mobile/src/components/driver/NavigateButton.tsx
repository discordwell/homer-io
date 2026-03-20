import { Pressable, Text, StyleSheet, Platform, Linking } from 'react-native';
import { C, Size, Spacing, Radius } from '@/theme';

interface NavigateButtonProps {
  lat: number;
  lng: number;
  address?: string;
}

export function NavigateButton({ lat, lng, address }: NavigateButtonProps) {
  const handlePress = () => {
    const encodedAddr = encodeURIComponent(address || `${lat},${lng}`);
    const url = Platform.select({
      ios: `maps://app?daddr=${encodedAddr}&ll=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.icon}>🧭</Text>
      <Text style={styles.text}>Navigate</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: C.accent,
    borderRadius: Radius.lg,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.8,
  },
  icon: {
    fontSize: 20,
  },
  text: {
    fontSize: Size.lg,
    fontWeight: '700',
    color: '#000',
  },
});
