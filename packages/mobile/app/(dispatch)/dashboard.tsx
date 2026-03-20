import { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { useTrackingStore, type DeliveryEventItem } from '@/stores/tracking';
import { KPICard } from '@/components/KPICard';
import { Badge } from '@/components/Badge';
import { C, Size, Spacing, Radius, Base } from '@/theme';
import { useState } from 'react';

interface DashboardStats {
  totalOrders: number;
  activeRoutes: number;
  activeDrivers: number;
  deliveryRate: number;
  recentOrders: Array<{ id: string; recipientName: string; status: string; createdAt: string }>;
}

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { deliveryEvents } = useTrackingStore();

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<DashboardStats>('/dashboard/stats');
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch dashboard:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <FlatList
        data={deliveryEvents.slice(0, 20)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Fleet overview</Text>

            {/* KPI Grid */}
            <View style={styles.kpiGrid}>
              <KPICard
                label="Active Routes"
                value={stats?.activeRoutes ?? '--'}
              />
              <KPICard
                label="Orders Today"
                value={stats?.totalOrders ?? '--'}
              />
              <KPICard
                label="Active Drivers"
                value={stats?.activeDrivers ?? '--'}
                color={C.green}
              />
              <KPICard
                label="Delivery Rate"
                value={stats ? `${Math.round(stats.deliveryRate)}%` : '--%'}
                color={stats && stats.deliveryRate >= 90 ? C.green : C.yellow}
              />
            </View>

            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>
        }
        renderItem={({ item }) => <EventRow event={item} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No recent delivery events</Text>
        }
        refreshing={loading}
        onRefresh={async () => {
          setLoading(true);
          try {
            const data = await api.get<DashboardStats>('/dashboard/stats');
            setStats(data);
          } finally {
            setLoading(false);
          }
        }}
      />
    </SafeAreaView>
  );
}

function EventRow({ event }: { event: DeliveryEventItem }) {
  const time = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={styles.eventRow}>
      <View style={[styles.eventDot, { backgroundColor: event.status === 'delivered' ? C.green : C.red }]} />
      <View style={styles.eventContent}>
        <Text style={styles.eventName} numberOfLines={1}>{event.recipientName}</Text>
        <Text style={styles.eventMeta}>{event.routeName} {'\u00B7'} {time}</Text>
      </View>
      <Badge color={event.status === 'delivered' ? 'green' : 'red'}>{event.status}</Badge>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
    paddingBottom: 100,
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
    marginBottom: Spacing.lg,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: Size.lg,
    fontWeight: '700',
    color: C.text,
    marginBottom: Spacing.md,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventContent: {
    flex: 1,
  },
  eventName: {
    fontSize: Size.md,
    fontWeight: '500',
    color: C.text,
  },
  eventMeta: {
    fontSize: Size.sm,
    color: C.dim,
    marginTop: 2,
  },
  emptyText: {
    color: C.muted,
    fontSize: Size.md,
    textAlign: 'center',
    paddingVertical: Spacing.xxl,
  },
});
