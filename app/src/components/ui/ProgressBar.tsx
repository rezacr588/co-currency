import { View } from 'react-native';

type ProgressBarVariant = 'default' | 'success' | 'danger' | 'warning';

interface ProgressBarProps {
  progress: number;
  variant?: ProgressBarVariant;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantStyles: Record<ProgressBarVariant, string> = {
  default: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
};

const heightStyles = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({
  progress,
  variant = 'default',
  height = 'md',
  className = '',
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View className={`bg-secondary rounded-full ${heightStyles[height]} ${className}`}>
      <View
        className={`h-full rounded-full ${variantStyles[variant]}`}
        style={{ width: `${clampedProgress}%` }}
      />
    </View>
  );
}
