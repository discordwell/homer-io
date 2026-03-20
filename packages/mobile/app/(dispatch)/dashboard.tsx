import { View, Text, StyleSheet } from 'react-native';
import { C, Size, Spacing, Base } from '@/theme';

export default function DashboardScreen() {
  return (
    <View style={Base.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Fleet overview</Text>
      </View>
      <View style={styles.kpiGrid}>
        <KPIPlaceholder label="Active Routes" value="--" />
        <KPIPlaceholder label="Deliveries Today" value="--" />
        <KPIPlaceholder label="Active Drivers" value="--" />
        <KPIPlaceholder label="Delivery Rate" value="--%" />
      </View>
    </View>
  );
}

function KPIPlaceholder({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: Size.xxl,
    fontWeight: '700',
    color: C.text,
  },
  subtitle: {
    fontSize: Size.md,
    color: C.dim,
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  kpiCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.lg,
    width: '47%',
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: Size.xxl,
    fontWeight: '800',
    color: C.accent,
  },
  kpiLabel: {
    fontSize: Size.sm,
    color: C.dim,
    marginTop: 4,
  },
});
