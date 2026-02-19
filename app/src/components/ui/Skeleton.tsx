import { useEffect, useRef } from 'react';
import { View, ViewProps, Animated, DimensionValue } from 'react-native';
import { useTheme } from 'styled-components/native';

interface SkeletonProps extends ViewProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  variant?: 'rectangular' | 'circular' | 'text';
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius,
  variant = 'rectangular',
  style,
  ...props
}: SkeletonProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const getRadius = () => {
    if (borderRadius !== undefined) return borderRadius;
    switch (variant) {
      case 'circular':
        return typeof height === 'number' ? height / 2 : 50;
      case 'text':
        return 4;
      default:
        return 8;
    }
  };

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.secondary,
          width,
          height,
          borderRadius: getRadius(),
          opacity,
        },
        style,
      ]}
      {...props}
    />
  );
}

// Pre-built skeleton layouts
export function SkeletonCard() {
  const theme = useTheme();
  const colors = theme.colors;
  return (
    <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={12} style={{ marginBottom: 8 }} />
      <Skeleton width="80%" height={12} />
    </View>
  );
}

export function SkeletonTransaction() {
  const theme = useTheme();
  const colors = theme.colors;
  return (
    <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Skeleton width="70%" height={14} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <Skeleton width={60} height={20} />
    </View>
  );
}

export function SkeletonBalance() {
  const theme = useTheme();
  const colors = theme.colors;
  return (
    <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Skeleton variant="circular" width={40} height={40} />
        <View style={{ marginLeft: 12 }}>
          <Skeleton width={60} height={18} style={{ marginBottom: 8 }} />
          <Skeleton width={40} height={12} />
        </View>
      </View>
      <Skeleton width={80} height={24} />
    </View>
  );
}

export function SkeletonGoalCard() {
  const theme = useTheme();
  const colors = theme.colors;
  return (
    <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Skeleton variant="circular" width={36} height={36} />
          <Skeleton width="50%" height={16} style={{ marginLeft: 12 }} />
        </View>
        <Skeleton width={50} height={20} borderRadius={12} />
      </View>
      <Skeleton width="100%" height={8} borderRadius={4} style={{ marginBottom: 8 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Skeleton width={80} height={12} />
        <Skeleton width={60} height={12} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3, ItemComponent = SkeletonCard }: { count?: number; ItemComponent?: React.ComponentType }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, index) => (
        <ItemComponent key={index} />
      ))}
    </View>
  );
}
