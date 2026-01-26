import { View, Text } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-secondary',
  success: 'bg-success/20',
  danger: 'bg-danger/20',
  warning: 'bg-warning/20',
  info: 'bg-primary/20',
};

const textStyles: Record<BadgeVariant, string> = {
  default: 'text-foreground',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-primary-foreground',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <View className={`px-2 py-1 rounded ${variantStyles[variant]} ${className}`}>
      <Text className={`text-xs font-semibold ${textStyles[variant]}`}>
        {children}
      </Text>
    </View>
  );
}
