import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActionSheetIOS, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOrdersStore, type Order } from '@/stores/orders';
import { FilterPills } from '@/components/FilterPills';
import { SearchBar } from '@/components/SearchBar';
import { Badge } from '@/components/Badge';
import { formatAddress } from '@/utils/address';
import { C, Size, Spacing, Radius, Base } from '@/theme';

const STATUS_FILTERS = [
  { label: 'All', value: null },
  { label: 'Pending', value: 'received' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Failed', value: 'failed' },
];

const statusColors: Record<string, string> = {
  received: 'dim', assigned: 'blue', in_transit: 'yellow', delivered: 'green', failed: 'red',
};

export default function OrdersScreen() {
  const router = useRouter();
  const { orders, loading, statusFilter, search, fetchOrders, setStatusFilter, setSearch } = useOrdersStore();
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    fetchOrders();
  }, []);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== search) setSearch(searchInput);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const renderOrder = useCallback(({ item }: { item: Order }) => (
    <Pressable
      onPress={() => router.push(`/(dispatch)/orders/${item.id}`)}
      style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderName} numberOfLines={1}>{item.recipientName}</Text>
        <Badge color={statusColors[item.status] || 'dim'}>{item.status.replace('_', ' ')}</Badge>
      </View>
      <Text style={styles.orderAddress} numberOfLines={1}>
        {formatAddress(item.deliveryAddress)}
      </Text>
      <View style={styles.orderFooter}>
        <Text style={styles.orderMeta}>{item.packageCount} pkg{item.packageCount !== 1 ? 's' : ''}</Text>
        <Text style={styles.orderMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
    </Pressable>
  ), []);

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
      </View>

      <SearchBar
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder="Search by name or address..."
      />

      <FilterPills
        options={STATUS_FILTERS}
        selected={statusFilter}
        onSelect={setStatusFilter}
      />

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        refreshing={loading}
        onRefresh={fetchOrders}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loading ? '' : 'No orders found'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={{ height: 8 }} />;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: Size.xxl,
    fontWeight: '700',
    color: C.text,
  },
  list: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  orderCard: {
    backgroundColor: C.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderName: {
    fontSize: Size.md,
    fontWeight: '600',
    color: C.text,
    flex: 1,
    marginRight: 8,
  },
  orderAddress: {
    fontSize: Size.sm,
    color: C.dim,
    marginBottom: 8,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderMeta: {
    fontSize: Size.xs,
    color: C.muted,
  },
  emptyText: {
    color: C.muted,
    fontSize: Size.md,
    textAlign: 'center',
    paddingVertical: Spacing.xxl,
  },
});
