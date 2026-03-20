import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { C, Size, Spacing, Base } from '@/theme';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={Base.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Route Detail</Text>
        <Text style={styles.subtitle}>ID: {id}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
  },
  title: { fontSize: Size.xxl, fontWeight: '700', color: C.text },
  subtitle: { fontSize: Size.sm, color: C.muted, marginTop: 4 },
});
