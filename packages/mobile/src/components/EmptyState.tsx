import { View, Text, StyleSheet } from 'react-native';
import { C, Size, Spacing, Base } from '@/theme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <View style={[Base.center, styles.container]}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Size.lg,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
  },
  description: {
    fontSize: Size.md,
    color: C.muted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
});
