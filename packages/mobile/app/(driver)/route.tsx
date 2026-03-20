import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDriverStore } from '@/stores/driver';
import { StopCard } from '@/components/driver/StopCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { formatAddress } from '@/utils/address';
import { C, Size, Spacing, Radius, alpha, Base } from '@/theme';

export default function DriverRouteScreen() {
  const router = useRouter();
  const { currentRoute, upcomingRoutes, loading, error, fetchCurrentRoute, fetchUpcomingRoutes } = useDriverStore();

  useEffect(() => {
    fetchCurrentRoute();
    fetchUpcomingRoutes();
  }, []);

  if (loading && !currentRoute) return <LoadingSpinner />;

  if (error) {
    return (
      <SafeAreaView style={Base.screen}>
        <View style={styles.errorContainer}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentRoute) {
    return (
      <SafeAreaView style={Base.screen}>
        <View style={styles.padding}>
          <EmptyState
            icon="📦"
            title="No Active Route"
            description="You don't have an active route right now. Check back when a dispatcher assigns one."
          />

          {upcomingRoutes.length > 0 && (
            <View style={styles.upcoming}>
              <Text style={styles.upcomingTitle}>Upcoming Routes</Text>
              {upcomingRoutes.map((route) => (
                <View key={route.id} style={styles.upcomingCard}>
                  <Text style={styles.upcomingName}>{route.name}</Text>
                  <Text style={styles.upcomingMeta}>
                    {route.totalStops} stop{route.totalStops !== 1 ? 's' : ''}
                    {route.plannedStartAt && ` \u00B7 ${new Date(route.plannedStartAt).toLocaleString()}`}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const stops = currentRoute.orders || [];
  const firstNonCompleted = stops.findIndex(
    (s) => s.status !== 'delivered' && s.status !== 'failed',
  );
  const progress = currentRoute.totalStops > 0
    ? (currentRoute.completedStops / currentRoute.totalStops) * 100
    : 0;

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <FlatList
        data={stops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.routeHeader}>
            <Text style={styles.routeName}>{currentRoute.name}</Text>
            <Text style={styles.routeMeta}>
              {currentRoute.completedStops} of {currentRoute.totalStops} stops completed
            </Text>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                {
                  width: `${progress}%` as `${number}%`,
                  backgroundColor: progress === 100 ? C.green : C.accent,
                },
              ]} />
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <StopCard
            recipientName={item.recipientName}
            address={formatAddress(item.deliveryAddress as { street?: string; city?: string; state?: string; zip?: string })}
            status={item.status}
            packageCount={item.packageCount}
            stopSequence={item.stopSequence}
            isNextStop={index === firstNonCompleted}
            onPress={() => router.push(`/(driver)/stop/${currentRoute.id}/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={ListSeparator}
        onRefresh={() => { fetchCurrentRoute(); fetchUpcomingRoutes(); }}
        refreshing={loading}
      />
    </SafeAreaView>
  );
}

function ListSeparator() {
  return <View style={separatorStyle} />;
}
const separatorStyle = { height: 8 };

const styles = StyleSheet.create({
  padding: {
    padding: Spacing.lg,
  },
  errorContainer: {
    padding: Spacing.lg,
  },
  errorBox: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: alpha(C.red, 0.08),
    borderWidth: 1,
    borderColor: alpha(C.red, 0.19),
  },
  errorText: {
    color: C.red,
    fontSize: Size.md,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  routeHeader: {
    backgroundColor: C.bg2,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.md,
  },
  routeName: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
  },
  routeMeta: {
    fontSize: Size.sm,
    color: C.dim,
    marginBottom: 12,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: C.muted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  upcoming: {
    marginTop: Spacing.xxl,
  },
  upcomingTitle: {
    fontSize: Size.lg,
    fontWeight: '700',
    color: C.text,
    marginBottom: 12,
  },
  upcomingCard: {
    padding: 14,
    backgroundColor: C.bg2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  upcomingName: {
    fontWeight: '600',
    fontSize: Size.md,
    color: C.text,
    marginBottom: 4,
  },
  upcomingMeta: {
    fontSize: Size.sm,
    color: C.dim,
  },
});
