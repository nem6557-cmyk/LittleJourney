import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../theme/colors';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

const SkeletonBlock: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = BorderRadius.sm,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: Colors.borderLight, opacity },
        style,
      ]}
      accessibilityLabel="Loading content"
      accessibilityRole="none"
    />
  );
};

export const TimelineSkeleton = () => (
  <View style={styles.container} accessibilityLabel="Loading timeline" accessibilityRole="none">
    {/* Header skeleton */}
    <View style={styles.header}>
      <SkeletonBlock width={120} height={14} />
      <SkeletonBlock width={180} height={28} style={{ marginTop: Spacing.sm }} />
    </View>

    {/* Stats skeleton */}
    <View style={styles.statsRow}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.statItem}>
          <SkeletonBlock width={32} height={32} borderRadius={16} />
          <SkeletonBlock width={30} height={18} style={{ marginTop: Spacing.xs }} />
          <SkeletonBlock width={40} height={10} style={{ marginTop: Spacing.xs }} />
        </View>
      ))}
    </View>

    {/* Timeline cards skeleton */}
    {[1, 2, 3, 4].map((i) => (
      <View key={i} style={styles.card}>
        <View style={styles.cardHeader}>
          <SkeletonBlock width={40} height={40} borderRadius={20} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <SkeletonBlock width="70%" height={14} />
            <SkeletonBlock width="40%" height={10} style={{ marginTop: Spacing.xs }} />
          </View>
        </View>
        <SkeletonBlock width="100%" height={12} style={{ marginTop: Spacing.md }} />
        <SkeletonBlock width="85%" height={12} style={{ marginTop: Spacing.sm }} />
        {i % 2 === 0 && (
          <SkeletonBlock width="100%" height={120} borderRadius={BorderRadius.md} style={{ marginTop: Spacing.md }} />
        )}
      </View>
    ))}
  </View>
);

export const MessagesSkeleton = () => (
  <View style={styles.container} accessibilityLabel="Loading messages" accessibilityRole="none">
    {[1, 2, 3, 4, 5].map((i) => (
      <View key={i} style={styles.messageRow}>
        <SkeletonBlock width={48} height={48} borderRadius={24} />
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <SkeletonBlock width="60%" height={14} />
          <SkeletonBlock width="80%" height={12} style={{ marginTop: Spacing.sm }} />
        </View>
        <SkeletonBlock width={40} height={10} />
      </View>
    ))}
  </View>
);

export const ProfileSkeleton = () => (
  <View style={styles.container} accessibilityLabel="Loading profile" accessibilityRole="none">
    <View style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
      <SkeletonBlock width={80} height={80} borderRadius={40} />
      <SkeletonBlock width={150} height={20} style={{ marginTop: Spacing.md }} />
      <SkeletonBlock width={100} height={14} style={{ marginTop: Spacing.sm }} />
    </View>
    {[1, 2, 3].map((section) => (
      <View key={section} style={{ marginTop: Spacing.lg, paddingHorizontal: Spacing.lg }}>
        <SkeletonBlock width={80} height={12} style={{ marginBottom: Spacing.md }} />
        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.menuItemSkeleton}>
            <SkeletonBlock width={36} height={36} borderRadius={18} />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <SkeletonBlock width="60%" height={14} />
              <SkeletonBlock width="40%" height={10} style={{ marginTop: Spacing.xs }} />
            </View>
          </View>
        ))}
      </View>
    ))}
  </View>
);

export { SkeletonBlock };

const styles = StyleSheet.create({
  container: { padding: Spacing.lg },
  header: { marginBottom: Spacing.lg },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.xl },
  statItem: { alignItems: 'center' },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
});
