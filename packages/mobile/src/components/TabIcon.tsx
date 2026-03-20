import { View, Text, StyleSheet } from 'react-native';

const icons: Record<string, string> = {
  route: '\u2630',
  map: '\u25C9',
  profile: '\u263A',
  dashboard: '\u25A3',
  orders: '\u2630',
  chat: '\u2B50',
  more: '\u22EF',
};

export function TabIcon({ name, color }: { name: string; color: string }) {
  return (
    <View style={styles.container}>
      <Text style={[styles.icon, { color }]}>{icons[name] || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', width: 24, height: 24 },
  icon: { fontSize: 20 },
});
