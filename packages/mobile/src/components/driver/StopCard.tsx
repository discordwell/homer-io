import { Pressable, View, Text, StyleSheet } from 'react-native';
import { C, Size, Spacing, Radius, alpha } from '@/theme';
import { Badge } from '@/components/Badge';

interface StopCardProps {
  recipientName: string;
  address: string;
  status: string;
  packageCount: number;
  stopSequence: number | null;
  isNextStop: boolean;
  onPress: () => void;
}

const statusColors: Record<string, string> = {
  assigned: 'blue',
  in_transit: 'yellow',
  delivered: 'green',
  failed: 'red',
  received: 'dim',
};

export function StopCard({
  recipientName,
  address,
  status,
  packageCount,
  stopSequence,
  isNextStop,
  onPress,
}: StopCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isNextStop && styles.nextStop,
        pressed && styles.pressed,
      ]}
    >
      {/* Stop number */}
      <View style={[styles.stopNum, isNextStop && styles.stopNumActive]}>
        <Text style={[styles.stopNumText, isNextStop && styles.stopNumTextActive]}>
          {stopSequence ?? '?'}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {recipientName}
        </Text>
        <Text style={styles.address} numberOfLines={1}>
          {address}
        </Text>
      </View>

      {/* Right side */}
      <View style={styles.right}>
        <Badge color={statusColors[status] || 'dim'}>
          {status.replace('_', ' ')}
        </Badge>
        <Text style={styles.pkg}>
          {packageCount} pkg{packageCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    minHeight: 44,
  },
  nextStop: {
    backgroundColor: alpha(C.accent, 0.06),
    borderColor: C.accent,
    borderLeftWidth: 3,
  },
  pressed: {
    opacity: 0.7,
  },
  stopNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNumActive: {
    backgroundColor: C.accent,
  },
  stopNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
  },
  stopNumTextActive: {
    color: C.bg,
  },
  content: {
    flex: 1,
  },
  name: {
    fontWeight: '600',
    fontSize: Size.md,
    color: C.text,
    marginBottom: 2,
  },
  address: {
    fontSize: Size.sm,
    color: C.dim,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  pkg: {
    fontSize: 11,
    color: C.dim,
  },
});
