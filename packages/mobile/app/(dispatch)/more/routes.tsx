import { useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useRoutesStore, type Route } from '@/stores/routes';
import { FilterPills } from '@/components/FilterPills';
import { Badge } from '@/components/Badge';
import { C, Size, Spacing, Radius, Base } from '@/theme';

const STATUS_FILTERS = [
  { label: 'All', value: null },
  { label: 'Draft', value: 'draft' },
  { label: 'Planned', value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

const statusColors: Record<string, string> = {
  draft: 'dim', planned: 'blue', in_progress: 'yellow', completed: 'green', cancelled: 'red',
};

export default function RoutesScreen() {
  const router = useRouter();
  const { routes, loading, statusFilter, fetchRoutes, setStatusFilter } = useRoutesStore();

  useEffect(() => { fetchRoutes(); }, []);

  const renderRoute = useCallback(({ item }: { item: Route }) => {
    const progress = item.totalStops > 0 ? (item.completedStops / item.totalStops) * 100 : 0;
    return (
      <Pressable
        onPress={() => router.push(`/(dispatch)/more/routes/${item.id}`)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.routeName} numberOfLines={1}>{item.name}</Text>
          <Badge color={statusColors[item.status] || 'dim'}>{item.status.replace('_', ' ')}</Badge>
        </View>
        <Text style={styles.routeMeta}>
          {item.completedStops}/{item.totalStops} stops
          {item.totalDistance ? ` \u00B7 ${Number(item.totalDistance).toFixed(1)} km` : ''}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` as `${number}%`, backgroundColor: progress === 100 ? C.green : C.accent }]} />
        </View>
      </Pressable>
    );
  }, []);

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Routes</Text>
      </View>
      <FilterPills options={STATUS_FILTERS} selected={statusFilter} onSelect={setStatusFilter} />
      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        renderItem={renderRoute}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        refreshing={loading}
        onRefresh={fetchRoutes}
        ListEmptyComponent={<Text style={styles.emptyText}>{loading ? '' : 'No routes found'}</Text>}
      />
    </SafeAreaView>
  );
}

function Separator() { return <View style={{ height: 8 }} />; }

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontSize: Size.xxl, fontWeight: '700', color: C.text },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: C.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.lg },
  pressed: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  routeName: { fontSize: Size.md, fontWeight: '600', color: C.text, flex: 1, marginRight: 8 },
  routeMeta: { fontSize: Size.sm, color: C.dim, marginBottom: 8 },
  progressTrack: { height: 4, backgroundColor: C.muted, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  emptyText: { color: C.muted, fontSize: Size.md, textAlign: 'center', paddingVertical: Spacing.xxl },
});
