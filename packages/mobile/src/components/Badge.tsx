import { View, Text, StyleSheet } from 'react-native';
import { C, Size, Radius } from '@/theme';

const colorMap: Record<string, string> = {
  green: C.green,
  yellow: C.yellow,
  red: C.red,
  orange: C.orange,
  blue: C.accent,
  purple: C.purple,
  dim: C.muted,
};

interface BadgeProps {
  color: string;
  children: string;
}

export function Badge({ color, children }: BadgeProps) {
  const c = colorMap[color] || C.muted;
  return (
    <View style={[styles.badge, { backgroundColor: `${c}20` }]}>
      <Text style={[styles.text, { color: c }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  text: {
    fontSize: Size.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
