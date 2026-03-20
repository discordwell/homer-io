import { useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotificationsStore, type AppNotification } from '@/stores/notifications';
import { C, Size, Spacing, Radius, alpha, Base } from '@/theme';

const typeIcons: Record<string, string> = {
  delivery_completed: '✅',
  delivery_failed: '❌',
  route_started: '🚀',
  route_completed: '🏁',
  driver_offline: '📴',
  order_received: '📦',
  team_invite: '👋',
  system: '⚙️',
};

export default function NotificationsScreen() {
  const { notifications, unreadCount, loading, fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead } = useNotificationsStore();

  useEffect(() => { fetchNotifications(); fetchUnreadCount(); }, []);

  const renderItem = useCallback(({ item }: { item: AppNotification }) => {
    const isUnread = !item.readAt;
    const time = new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
      <Pressable
        onPress={() => { if (isUnread) markAsRead(item.id); }}
        style={[styles.item, isUnread && styles.itemUnread]}
      >
        <Text style={styles.icon}>{typeIcons[item.type] || '🔔'}</Text>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]}>{item.title}</Text>
          <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.itemTime}>{time}</Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </Pressable>
    );
  }, []);

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={markAllAsRead} hitSlop={12}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={() => { fetchNotifications(); fetchUnreadCount(); }}
        ListEmptyComponent={<Text style={styles.emptyText}>{loading ? '' : 'No notifications'}</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: Size.xxl, fontWeight: '700', color: C.text },
  countBadge: { backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  countText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  markAll: { color: C.accent, fontSize: Size.sm, fontWeight: '600' },
  list: { paddingBottom: 100 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border },
  itemUnread: { backgroundColor: alpha(C.accent, 0.04) },
  icon: { fontSize: 20, marginTop: 2 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: Size.md, fontWeight: '500', color: C.text },
  itemTitleUnread: { fontWeight: '700' },
  itemBody: { fontSize: Size.sm, color: C.dim, marginTop: 2, lineHeight: 18 },
  itemTime: { fontSize: Size.xs, color: C.muted, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, marginTop: 6 },
  emptyText: { color: C.muted, fontSize: Size.md, textAlign: 'center', paddingVertical: Spacing.xxl },
});
