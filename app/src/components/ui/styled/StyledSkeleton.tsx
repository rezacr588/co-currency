import { useEffect } from 'react';
import { View, type DimensionValue, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from 'styled-components/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

type SkeletonVariant = 'rectangular' | 'circular' | 'text';

interface StyledSkeletonProps extends ViewProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  variant?: SkeletonVariant;
}

export function StyledSkeleton({
  width = '100%',
  height = 20,
  borderRadius,
  variant = 'rectangular',
  style,
  ...props
}: StyledSkeletonProps) {
  const theme = useTheme();
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, [translateX]);

  const getRadius = () => {
    if (borderRadius !== undefined) return borderRadius;
    switch (variant) {
      case 'circular':
        return typeof height === 'number' ? height / 2 : 50;
      case 'text':
        return theme.radii.sm;
      default:
        return theme.radii.md;
    }
  };

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 200 }],
    opacity: 0.4,
  }));

  const shimmerLight = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)';
  const shimmerDark = 'transparent';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: getRadius(),
          backgroundColor: theme.colors.secondary,
          overflow: 'hidden',
        } as ViewStyle,
        style,
      ]}
      {...props}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          },
          shimmerStyle,
        ]}
      >
        <LinearGradient
          colors={[shimmerDark, shimmerLight, shimmerDark]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </Animated.View>
  );
}

// ─── Pre-built skeleton layouts ──────────────────────────────

export function SkeletonCard() {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.xl,
        },
        theme.shadows.sm,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <StyledSkeleton variant="circular" width={40} height={40} />
        <View style={{ marginStart: 12, flex: 1 }}>
          <StyledSkeleton width="60%" height={16} style={{ marginBottom: 8 }} />
          <StyledSkeleton width="40%" height={12} />
        </View>
      </View>
      <StyledSkeleton width="100%" height={12} style={{ marginBottom: 8 }} />
      <StyledSkeleton width="80%" height={12} />
    </View>
  );
}

export function SkeletonTransaction() {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        theme.shadows.sm,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <StyledSkeleton variant="circular" width={40} height={40} />
        <View style={{ marginStart: 12, flex: 1 }}>
          <StyledSkeleton width="70%" height={14} style={{ marginBottom: 8 }} />
          <StyledSkeleton width="40%" height={12} />
        </View>
      </View>
      <StyledSkeleton width={60} height={20} />
    </View>
  );
}
