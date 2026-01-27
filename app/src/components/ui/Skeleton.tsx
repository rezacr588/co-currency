import { useEffect, useRef } from 'react';
import { View, ViewProps, Animated, DimensionValue } from 'react-native';

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
  className = '',
  ...props
}: SkeletonProps) {
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
      className={`bg-secondary ${className}`}
      style={[
        {
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
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <View className={`bg-card p-4 rounded-xl ${className}`}>
      <View className="flex-row items-center mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <View className="ml-3 flex-1">
          <Skeleton width="60%" height={16} className="mb-2" />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={12} className="mb-2" />
      <Skeleton width="80%" height={12} />
    </View>
  );
}

export function SkeletonTransaction({ className = '' }: { className?: string }) {
  return (
    <View className={`bg-card p-4 rounded-xl flex-row items-center justify-between ${className}`}>
      <View className="flex-row items-center flex-1">
        <Skeleton variant="circular" width={40} height={40} />
        <View className="ml-3 flex-1">
          <Skeleton width="70%" height={14} className="mb-2" />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <Skeleton width={60} height={20} />
    </View>
  );
}

export function SkeletonBalance({ className = '' }: { className?: string }) {
  return (
    <View className={`bg-card p-4 rounded-xl flex-row items-center justify-between ${className}`}>
      <View className="flex-row items-center">
        <Skeleton variant="circular" width={40} height={40} />
        <View className="ml-3">
          <Skeleton width={60} height={18} className="mb-2" />
          <Skeleton width={40} height={12} />
        </View>
      </View>
      <Skeleton width={80} height={24} />
    </View>
  );
}

export function SkeletonGoalCard({ className = '' }: { className?: string }) {
  return (
    <View className={`bg-card p-4 rounded-xl ${className}`}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <Skeleton variant="circular" width={36} height={36} />
          <Skeleton width="50%" height={16} className="ml-3" />
        </View>
        <Skeleton width={50} height={20} borderRadius={12} />
      </View>
      <Skeleton width="100%" height={8} borderRadius={4} className="mb-2" />
      <View className="flex-row justify-between">
        <Skeleton width={80} height={12} />
        <Skeleton width={60} height={12} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3, ItemComponent = SkeletonCard }: { count?: number; ItemComponent?: React.ComponentType<{ className?: string }> }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, index) => (
        <ItemComponent key={index} />
      ))}
    </View>
  );
}
