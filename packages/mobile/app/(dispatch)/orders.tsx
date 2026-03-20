import { View, Text, StyleSheet } from 'react-native';
import { C, Size, Spacing, Base } from '@/theme';

export default function OrdersScreen() {
  return (
    <View style={Base.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
      </View>
      <View style={[Base.center, { flex: 1 }]}>
        <Text style={styles.empty}>Order list will load here</Text>
      </View>
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
  empty: {
    color: C.muted,
    fontSize: Size.md,
  },
});
