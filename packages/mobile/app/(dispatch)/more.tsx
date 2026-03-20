import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { C, Size, Spacing, Radius, Base } from '@/theme';

export default function MoreScreen() {
  const router = useRouter();

  const items = [
    { label: 'Notifications', route: '/(dispatch)/more/notifications' as const },
    { label: 'Routes', route: '/(dispatch)/more/routes' as const },
    { label: 'Fleet', route: '/(dispatch)/more/fleet' as const },
    { label: 'Profile', route: '/(dispatch)/more/profile' as const },
  ];

  return (
    <View style={Base.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>
      <ScrollView style={styles.list}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            style={styles.row}
            onPress={() => router.push(item.route)}
          >
            <Text style={styles.rowText}>{item.label}</Text>
            <Text style={styles.chevron}>&rsaquo;</Text>
          </Pressable>
        ))}
      </ScrollView>
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
  list: {
    paddingHorizontal: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowText: {
    fontSize: Size.lg,
    color: C.text,
  },
  chevron: {
    fontSize: Size.xl,
    color: C.muted,
  },
});
