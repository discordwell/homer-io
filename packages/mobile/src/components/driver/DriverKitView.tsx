import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { C, Size, Spacing, Radius, alpha, Base } from '@/theme';

interface DriverKitViewProps {
  routeId: string;
  onDismiss: () => void;
}

interface KitItem {
  id: string;
  orderId: string;
  recipientName: string;
  productName: string;
  quantity: number;
  trackingTag: string;
  price: number;
  weight?: number;
  status?: string;
}

interface Kit {
  id: string;
  status: 'loading' | 'loaded' | 'in_transit' | 'reconciling' | 'reconciled';
  items: KitItem[];
  totalItems: number;
  totalValue: number;
  totalWeight: number;
}

interface OrderGroup {
  orderId: string;
  recipientName: string;
  data: KitItem[];
}

const statusBadgeColor: Record<string, string> = {
  loading: 'yellow',
  loaded: 'blue',
  in_transit: 'orange',
  reconciling: 'purple',
  reconciled: 'green',
};

export function DriverKitView({ routeId, onDismiss }: DriverKitViewProps) {
  const [kit, setKit] = useState<Kit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchKit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Kit>(`/cannabis/kits/route/${routeId}`);
      setKit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load kit');
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    fetchKit();
  }, [fetchKit]);

  const handleMarkLoaded = async () => {
    if (!kit) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/cannabis/kits/${kit.id}/load`);
      await fetchKit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark kit as loaded');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartDelivery = async () => {
    if (!kit) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/cannabis/kits/${kit.id}/transit`);
      await fetchKit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start delivery');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!kit || (kit.items && kit.items.length === 0)) {
    return (
      <SafeAreaView style={Base.screen} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Kit</Text>
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Text style={styles.dismissText}>Close</Text>
          </Pressable>
        </View>
        <EmptyState
          title="No items in kit"
          description="This route has no kit items assigned yet."
        />
      </SafeAreaView>
    );
  }

  // Group items by order
  const orderMap = new Map<string, OrderGroup>();
  for (const item of kit.items) {
    const existing = orderMap.get(item.orderId);
    if (existing) {
      existing.data.push(item);
    } else {
      orderMap.set(item.orderId, {
        orderId: item.orderId,
        recipientName: item.recipientName,
        data: [item],
      });
    }
  }
  const sections = Array.from(orderMap.values());

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Kit</Text>
        </View>
        <View style={Base.row}>
          <Badge color={statusBadgeColor[kit.status] || 'dim'}>
            {kit.status.replace('_', ' ')}
          </Badge>
          <Pressable onPress={onDismiss} hitSlop={12} style={{ marginLeft: Spacing.md }}>
            <Text style={styles.dismissText}>Close</Text>
          </Pressable>
        </View>
      </View>

      {/* Totals bar */}
      <View style={styles.totalsBar}>
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>{kit.totalItems}</Text>
          <Text style={styles.totalLabel}>Items</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>${kit.totalValue.toFixed(2)}</Text>
          <Text style={styles.totalLabel}>Value</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>{kit.totalWeight.toFixed(1)}g</Text>
          <Text style={styles.totalLabel}>Weight</Text>
        </View>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Items grouped by order */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionOrderId}>
              Order {section.orderId.slice(-6).toUpperCase()}
            </Text>
            <Text style={styles.sectionRecipient}>{section.recipientName}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemRow}>
              <Text style={styles.productName} numberOfLines={1}>
                {item.productName}
              </Text>
              <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            </View>
            <View style={styles.itemRow}>
              <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
              <Text style={styles.itemTag}>{item.trackingTag}</Text>
            </View>
          </View>
        )}
        renderSectionFooter={() => <View style={{ height: Spacing.md }} />}
      />

      {/* Action buttons */}
      {(kit.status === 'loading' || kit.status === 'loaded') && (
        <View style={styles.footer}>
          {kit.status === 'loading' && (
            <Pressable
              onPress={handleMarkLoaded}
              disabled={actionLoading}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.loadBtn,
                pressed && styles.pressed,
                actionLoading && styles.disabled,
              ]}
            >
              <Text style={styles.actionBtnText}>
                {actionLoading ? 'Loading...' : 'Mark as Loaded'}
              </Text>
            </Pressable>
          )}
          {kit.status === 'loaded' && (
            <Pressable
              onPress={handleStartDelivery}
              disabled={actionLoading}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.transitBtn,
                pressed && styles.pressed,
                actionLoading && styles.disabled,
              ]}
            >
              <Text style={styles.transitBtnText}>
                {actionLoading ? 'Starting...' : 'Start Delivery'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg2,
  },
  headerTitle: {
    fontSize: Size.xl,
    fontWeight: '700',
    color: C.text,
  },
  dismissText: {
    fontSize: Size.md,
    color: C.dim,
    minWidth: 44,
    minHeight: 44,
    textAlignVertical: 'center',
    textAlign: 'right',
    lineHeight: 44,
  },
  totalsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: C.bg2,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  totalItem: {
    flex: 1,
    alignItems: 'center',
  },
  totalValue: {
    fontSize: Size.lg,
    fontWeight: '700',
    color: C.text,
  },
  totalLabel: {
    fontSize: Size.xs,
    color: C.dim,
    marginTop: 2,
  },
  totalDivider: {
    width: 1,
    height: 28,
    backgroundColor: C.border,
  },
  errorBox: {
    margin: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: alpha(C.red, 0.08),
    borderWidth: 1,
    borderColor: alpha(C.red, 0.19),
  },
  errorText: {
    color: C.red,
    fontSize: Size.sm,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionOrderId: {
    fontSize: Size.sm,
    fontWeight: '600',
    color: C.accent,
  },
  sectionRecipient: {
    fontSize: Size.sm,
    color: C.dim,
  },
  itemCard: {
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: {
    fontSize: Size.md,
    fontWeight: '600',
    color: C.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  itemPrice: {
    fontSize: Size.md,
    fontWeight: '600',
    color: C.green,
  },
  itemMeta: {
    fontSize: Size.sm,
    color: C.dim,
  },
  itemTag: {
    fontSize: Size.xs,
    color: C.muted,
    fontFamily: 'SpaceMono',
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg2,
  },
  actionBtn: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  loadBtn: {
    backgroundColor: C.accent,
  },
  actionBtnText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: '#000',
  },
  transitBtn: {
    backgroundColor: C.green,
  },
  transitBtnText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: '#fff',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
