import { useEffect } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoutesStore } from '@/stores/routes';
import { Badge } from '@/components/Badge';
import { formatAddress } from '@/utils/address';
import { C, Size, Spacing, Radius, Base } from '@/theme';

const statusColors: Record<string, string> = {
  assigned: 'blue', in_transit: 'yellow', delivered: 'green', failed: 'red', received: 'dim',
};

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentRoute, loading, fetchRoute } = useRoutesStore();

  useEffect(() => { fetchRoute(id!); }, [id]);

  const stops = currentRoute?.orders || [];
  const progress = currentRoute && currentRoute.totalStops > 0
    ? (currentRoute.completedStops / currentRoute.totalStops) * 100 : 0;

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>{'\u2190'} Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{currentRoute?.name || 'Route'}</Text>
        {currentRoute && <Badge color={statusColors[currentRoute.status] || 'dim'}>{currentRoute.status.replace('_', ' ')}</Badge>}
      </View>

      {currentRoute && (
        <View style={styles.infoBar}>
          <Text style={styles.infoText}>{currentRoute.completedStops}/{currentRoute.totalStops} stops</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` as `${number}%` }]} />
          </View>
        </View>
      )}

      <FlatList
        data={stops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <View style={styles.stopRow}>
            <View style={[styles.stopNum, { backgroundColor: statusColors[item.status] === 'green' ? C.green : statusColors[item.status] === 'red' ? C.red : C.accent }]}>
              <Text style={styles.stopNumText}>{item.stopSequence ?? index + 1}</Text>
            </View>
            <View style={styles.stopContent}>
              <Text style={styles.stopName} numberOfLines={1}>{item.recipientName}</Text>
              <Text style={styles.stopAddr} numberOfLines={1}>{formatAddress(item.deliveryAddress)}</Text>
            </View>
            <Badge color={statusColors[item.status] || 'dim'}>{item.status.replace('_', ' ')}</Badge>
          </View>
        )}
        refreshing={loading}
        onRefresh={() => fetchRoute(id!)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 12, backgroundColor: C.bg2, borderBottomWidth: 1, borderBottomColor: C.border },
  backText: { color: C.accent, fontSize: Size.md, minWidth: 44 },
  headerTitle: { flex: 1, fontWeight: '600', fontSize: 15, color: C.text },
  infoBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: C.bg2, borderBottomWidth: 1, borderBottomColor: C.border },
  infoText: { fontSize: Size.sm, color: C.dim, marginBottom: 6 },
  progressTrack: { height: 4, backgroundColor: C.muted, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: C.accent },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  stopNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stopNumText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stopContent: { flex: 1 },
  stopName: { fontSize: Size.md, fontWeight: '500', color: C.text },
  stopAddr: { fontSize: Size.sm, color: C.dim, marginTop: 2 },
});
