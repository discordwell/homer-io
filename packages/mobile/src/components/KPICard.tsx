import { View, Text, StyleSheet } from 'react-native';
import { C, Size, Spacing, Radius } from '@/theme';

interface KPICardProps {
  label: string;
  value: string | number;
  color?: string;
}

export function KPICard({ label, value, color = C.accent }: KPICardProps) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.lg,
    width: '47%',
    alignItems: 'center',
  },
  value: {
    fontSize: Size.xxl,
    fontWeight: '800',
  },
  label: {
    fontSize: Size.sm,
    color: C.dim,
    marginTop: 4,
  },
});
