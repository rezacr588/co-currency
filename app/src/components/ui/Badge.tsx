import { View, Text } from 'react-native';
import { useTheme } from 'styled-components/native';

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: any;
}

export function Badge({ variant = 'default', children, style }: BadgeProps) {
  const theme = useTheme();
  const colors = theme.colors;

  const variantStyles: Record<BadgeVariant, { bg: string }> = {
    default: { bg: colors.secondary },
    success: { bg: colors.success + '33' },
    danger: { bg: colors.danger + '33' },
    warning: { bg: colors.warning + '33' },
    info: { bg: colors.primary + '33' },
  };

  const textColors: Record<BadgeVariant, string> = {
    default: colors.foreground,
    success: colors.success,
    danger: colors.danger,
    warning: colors.warning,
    info: colors.primaryForeground,
  };

  return (
    <View style={[{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: variantStyles[variant].bg }, style]}>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: textColors[variant] }}>
        {children}
      </Text>
    </View>
  );
}
