import { useEffect } from 'react';
import { View } from 'react-native';
import { useTheme } from 'styled-components/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type ProgressVariant = 'default' | 'success' | 'danger' | 'warning';
type ProgressHeight = 'sm' | 'md' | 'lg';

interface StyledProgressBarProps {
  progress: number;
  variant?: ProgressVariant;
  height?: ProgressHeight;
}

const heightMap: Record<ProgressHeight, number> = {
  sm: 4,
  md: 8,
  lg: 12,
};

export function StyledProgressBar({
  progress,
  variant = 'default',
  height = 'md',
}: StyledProgressBarProps) {
  const theme = useTheme();
  const clamped = Math.min(Math.max(progress, 0), 100);
  const widthAnim = useSharedValue(0);

  useEffect(() => {
    widthAnim.value = withTiming(clamped, { duration: theme.animation.slow });
  }, [clamped, widthAnim, theme.animation.slow]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value}%`,
  }));

  const gradientMap: Record<ProgressVariant, [string, string]> = {
    default: [theme.colors.accent, theme.colors.accentHover],
    success: ['#16a34a', '#22c55e'],
    danger: ['#dc2626', '#ef4444'],
    warning: ['#d97706', '#f59e0b'],
  };

  const h = heightMap[height];
  const gradientColors = gradientMap[variant];

  return (
    <View
      style={{
        backgroundColor: theme.colors.secondary,
        borderRadius: theme.radii.full,
        height: h,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: theme.radii.full,
            overflow: 'hidden',
          },
          fillStyle,
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
