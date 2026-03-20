import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { Badge } from '@/components/Badge';
import { formatAddress } from '@/utils/address';
import { C, Size, Spacing, Radius, Base } from '@/theme';
import type { Order } from '@/stores/orders';

const statusColors: Record<string, string> = {
  received: 'dim', assigned: 'blue', in_transit: 'yellow', delivered: 'green', failed: 'red',
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    api.get<Order>(`/orders/${id}`).then(setOrder).catch(console.error);
  }, [id]);

  if (!order) return <View style={Base.screen} />;

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>{'\u2190'} Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Order Detail</Text>
        <Badge color={statusColors[order.status] || 'dim'}>{order.status.replace('_', ' ')}</Badge>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.name}>{order.recipientName}</Text>
          <Text style={styles.address}>{formatAddress(order.deliveryAddress)}</Text>
          {order.recipientPhone && (
            <Text style={styles.phone}>{order.recipientPhone}</Text>
          )}
        </View>

        <View style={styles.card}>
          <InfoRow label="Packages" value={`${order.packageCount}`} />
          {order.weight && <InfoRow label="Weight" value={`${order.weight} kg`} />}
          <InfoRow label="Priority" value={order.priority} />
          <InfoRow label="Created" value={new Date(order.createdAt).toLocaleDateString()} />
        </View>

        {order.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <Text style={styles.notes}>{order.notes}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    backgroundColor: C.bg2,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backText: { color: C.accent, fontSize: Size.md, minWidth: 44 },
  headerTitle: { flex: 1, fontWeight: '600', fontSize: 15, color: C.text },
  content: { padding: Spacing.lg, gap: 16 },
  card: {
    backgroundColor: C.bg2,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  name: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 8 },
  address: { fontSize: Size.md, color: C.dim, marginBottom: 4 },
  phone: { fontSize: Size.md, color: C.accent },
  sectionLabel: { fontSize: Size.sm, color: C.dim, marginBottom: 6, letterSpacing: 0.5 },
  notes: { fontSize: Size.md, color: C.text, lineHeight: 21 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoLabel: { fontSize: Size.sm, color: C.dim },
  infoValue: { fontSize: Size.md, fontWeight: '500', color: C.text, textTransform: 'capitalize' },
});
