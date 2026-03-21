import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { C, Radius, Spacing } from '@/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

function SkeletonBox({ width = '100%', height = 16, borderRadius = Radius.md, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius, backgroundColor: C.bg3, opacity },
        style,
      ]}
    />
  );
}

/** Skeleton for a card-style list item */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <SkeletonBox width={28} height={28} borderRadius={14} />
        <View style={styles.cardContent}>
          <SkeletonBox width="60%" height={14} />
          <SkeletonBox width="80%" height={12} style={{ marginTop: 6 }} />
        </View>
        <SkeletonBox width={60} height={20} borderRadius={Radius.sm} />
      </View>
    </View>
  );
}

/** Skeleton for the dashboard KPI grid */
export function SkeletonKPIGrid() {
  return (
    <View style={styles.kpiGrid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.kpiCard}>
          <SkeletonBox width={48} height={28} />
          <SkeletonBox width={80} height={12} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

/** Skeleton for a list of cards */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.lg,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardContent: {
    flex: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  kpiCard: {
    backgroundColor: C.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.lg,
    width: '47%',
    alignItems: 'center',
  },
  list: {
    gap: 0,
  },
});
