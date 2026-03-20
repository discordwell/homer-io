import { View, Text, StyleSheet } from 'react-native';
import { C, Size, Spacing, Base } from '@/theme';

export default function AIChatScreen() {
  return (
    <View style={Base.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Copilot</Text>
        <Text style={styles.subtitle}>Talk to your fleet</Text>
      </View>
      <View style={[Base.center, { flex: 1 }]}>
        <Text style={styles.prompt}>
          Try: "How many deliveries are left today?"
        </Text>
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
  subtitle: {
    fontSize: Size.md,
    color: C.dim,
    marginTop: 4,
  },
  prompt: {
    color: C.muted,
    fontSize: Size.md,
    fontStyle: 'italic',
  },
});
