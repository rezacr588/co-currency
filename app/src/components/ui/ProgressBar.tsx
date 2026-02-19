import { View } from 'react-native';
import { useTheme } from 'styled-components/native';

type ProgressBarVariant = 'default' | 'success' | 'danger' | 'warning';

interface ProgressBarProps {
  progress: number;
  variant?: ProgressBarVariant;
  height?: 'sm' | 'md' | 'lg';
  style?: any;
}

const heightValues = {
  sm: 4,
  md: 8,
  lg: 12,
};

export function ProgressBar({
  progress,
  variant = 'default',
  height = 'md',
  style,
}: ProgressBarProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const variantColors: Record<ProgressBarVariant, string> = {
    default: colors.accent,
    success: colors.success,
    danger: colors.danger,
    warning: colors.warning,
  };

  return (
    <View style={[{ backgroundColor: colors.secondary, borderRadius: 9999, height: heightValues[height] }, style]}>
      <View
        style={{
          height: '100%',
          borderRadius: 9999,
          backgroundColor: variantColors[variant],
          width: `${clampedProgress}%`,
        }}
      />
    </View>
  );
}
