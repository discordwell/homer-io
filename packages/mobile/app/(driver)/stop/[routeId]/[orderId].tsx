import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { NavigateButton } from '@/components/driver/NavigateButton';
import { PODFlow } from '@/components/driver/PODFlow';
import { DeliveryFailureFlow } from '@/components/driver/DeliveryFailureFlow';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Badge } from '@/components/Badge';
import { formatAddress } from '@/utils/address';
import { C, Size, Spacing, Radius, alpha, Base } from '@/theme';

const statusColors: Record<string, string> = {
  assigned: 'blue',
  in_transit: 'yellow',
  delivered: 'green',
  failed: 'red',
};

export default function StopDetailScreen() {
  const { routeId, orderId } = useLocalSearchParams<{ routeId: string; orderId: string }>();
  const router = useRouter();
  const { currentRoute, fetchCurrentRoute } = useDriverStore();
  const user = useAuthStore((s) => s.user);
  const isCannabis = user?.industry === 'cannabis';
  const [showPOD, setShowPOD] = useState(false);
  const [showFailure, setShowFailure] = useState(false);

  useEffect(() => {
    if (!currentRoute) fetchCurrentRoute();
  }, []);

  if (!currentRoute) return <LoadingSpinner />;

  const stop = currentRoute.orders?.find((o) => o.id === orderId);
  if (!stop) {
    return (
      <SafeAreaView style={Base.screen}>
        <View style={styles.errorContainer}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Stop not found</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (showPOD) {
    return (
      <PODFlow
        orderId={stop.id}
        routeId={routeId!}
        recipientName={stop.recipientName}
        requireIdVerification={isCannabis}
        minimumAge={isCannabis ? 21 : undefined}
        onComplete={() => {
          setShowPOD(false);
          router.back();
        }}
        onCancel={() => setShowPOD(false)}
      />
    );
  }

  if (showFailure) {
    return (
      <DeliveryFailureFlow
        orderId={stop.id}
        routeId={routeId!}
        onComplete={() => {
          setShowFailure(false);
          router.back();
        }}
        onCancel={() => setShowFailure(false)}
      />
    );
  }

  const isCompleted = stop.status === 'delivered' || stop.status === 'failed';
  const address = formatAddress(stop.deliveryAddress as { street?: string; city?: string; state?: string; zip?: string });

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backText}>{'\u2190'} Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Stop {stop.stopSequence}</Text>
        <Badge color={statusColors[stop.status] || 'dim'}>
          {stop.status.replace('_', ' ')}
        </Badge>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Recipient info */}
        <View style={styles.card}>
          <Text style={styles.recipientName}>{stop.recipientName}</Text>

          {/* Address */}
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>{address}</Text>
          </View>

          {/* Phone */}
          {stop.recipientPhone && (
            <Pressable
              style={styles.infoRow}
              onPress={() => Linking.openURL(`tel:${stop.recipientPhone}`)}
            >
              <Text style={styles.infoIcon}>📞</Text>
              <Text style={[styles.infoText, { color: C.accent }]}>{stop.recipientPhone}</Text>
            </Pressable>
          )}

          {/* Package count */}
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📦</Text>
            <Text style={styles.infoText}>
              {stop.packageCount} package{stop.packageCount !== 1 ? 's' : ''}
              {stop.weight ? ` \u00B7 ${stop.weight} kg` : ''}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {stop.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>DELIVERY NOTES</Text>
            <Text style={styles.notes}>{stop.notes}</Text>
          </View>
        )}

        {/* Time window */}
        {(stop.timeWindowStart || stop.timeWindowEnd) && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>TIME WINDOW</Text>
            <Text style={styles.timeWindow}>
              {stop.timeWindowStart && new Date(stop.timeWindowStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {stop.timeWindowStart && stop.timeWindowEnd && ' \u2014 '}
              {stop.timeWindowEnd && new Date(stop.timeWindowEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}

        {/* Navigate button */}
        {stop.deliveryLat && stop.deliveryLng && (
          <NavigateButton
            lat={Number(stop.deliveryLat)}
            lng={Number(stop.deliveryLng)}
            address={address}
          />
        )}
      </ScrollView>

      {/* Action buttons */}
      {!isCompleted && (
        <View style={styles.footer}>
          <Pressable
            onPress={() => setShowFailure(true)}
            style={({ pressed }) => [styles.actionBtn, styles.failBtn, pressed && styles.pressed]}
          >
            <Text style={styles.failBtnText}>Failed Delivery</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowPOD(true)}
            style={({ pressed }) => [styles.actionBtn, styles.completeBtn, { flex: 2 }, pressed && styles.pressed]}
          >
            <Text style={styles.completeBtnText}>Complete Delivery</Text>
          </Pressable>
        </View>
      )}

      {/* Completed status */}
      {isCompleted && (
        <View style={styles.footer}>
          <View style={[
            styles.completedBanner,
            { backgroundColor: stop.status === 'delivered' ? alpha(C.green, 0.08) : alpha(C.red, 0.08) },
            { borderColor: stop.status === 'delivered' ? alpha(C.green, 0.19) : alpha(C.red, 0.19) },
          ]}>
            <Text style={[styles.completedText, { color: stop.status === 'delivered' ? C.green : C.red }]}>
              {stop.status === 'delivered' ? 'Delivered' : 'Failed'}
            </Text>
            {stop.completedAt && (
              <Text style={styles.completedTime}>
                {new Date(stop.completedAt).toLocaleString()}
              </Text>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
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
  backBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    color: C.accent,
    fontSize: Size.md,
  },
  headerTitle: {
    flex: 1,
    fontWeight: '600',
    fontSize: 15,
    color: C.text,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.lg,
    gap: 16,
  },
  card: {
    backgroundColor: C.bg2,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  infoIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: Size.md,
    color: C.text,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: Size.sm,
    color: C.dim,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  notes: {
    fontSize: Size.md,
    color: C.text,
    lineHeight: 21,
  },
  timeWindow: {
    fontSize: Size.md,
    color: C.text,
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
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg2,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  failBtn: {
    borderWidth: 1,
    borderColor: C.red,
  },
  failBtnText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: C.red,
  },
  completeBtn: {
    backgroundColor: C.green,
  },
  completeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  completedBanner: {
    flex: 1,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  completedText: {
    fontSize: Size.md,
    fontWeight: '600',
  },
  completedTime: {
    fontSize: Size.sm,
    color: C.dim,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.8,
  },
});
