import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { C, Size, Spacing, Radius } from '@/theme';

interface FilterPillsProps {
  options: Array<{ label: string; value: string | null }>;
  selected: string | null;
  onSelect: (value: string | null) => void;
}

export function FilterPills({ options, selected, onSelect }: FilterPillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((opt) => {
        const isActive = selected === opt.value;
        return (
          <Pressable
            key={opt.value ?? 'all'}
            onPress={() => onSelect(opt.value)}
            style={[styles.pill, isActive && styles.pillActive]}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
  },
  pillActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  pillText: {
    fontSize: Size.sm,
    color: C.dim,
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#000',
    fontWeight: '600',
  },
});
