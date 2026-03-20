import { View, Text, StyleSheet } from 'react-native';
import { C, Size, Base } from '@/theme';

export default function FleetMapScreen() {
  return (
    <View style={[Base.screen, Base.center]}>
      <Text style={styles.title}>Live Fleet Map</Text>
      <Text style={styles.subtitle}>Driver positions will appear here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: Size.xxl,
    fontWeight: '700',
    color: C.text,
  },
  subtitle: {
    fontSize: Size.md,
    color: C.dim,
    marginTop: 8,
  },
});
