import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { ICON_SIZES } from '../../constants/icons';
import { useTheme } from 'styled-components/native';
import { spacing } from '../../theme';
import { Button } from './Button';

type EmptyStateVariant = 'default' | 'compact' | 'fullscreen';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Button shorthand -- renders an accent Button if provided */
  actionLabel?: string;
  onAction?: () => void;
  /** Icon size - defaults to 'xl' (48px) for empty states */
  iconSize?: keyof typeof ICON_SIZES | number;
  /** Layout variant */
  variant?: EmptyStateVariant;
}

const variantPadding: Record<EmptyStateVariant, number> = {
  default: spacing.xxxl,
  compact: spacing.xl,
  fullscreen: spacing.xxxl,
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  iconSize = 'xl',
  variant = 'default',
}: EmptyStateProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const size = typeof iconSize === 'number' ? iconSize : ICON_SIZES[iconSize];

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: theme.radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        padding: variantPadding[variant],
        flex: variant === 'fullscreen' ? 1 : undefined,
      }}
    >
      <View
        style={{
          backgroundColor: colors.muted,
          borderRadius: theme.radii.lg,
          padding: variant === 'compact' ? theme.spacing.sm + 2 : theme.spacing.md + 2,
          marginBottom: variant === 'compact' ? theme.spacing.md : theme.spacing.lg,
        }}
      >
        <Icon size={size} color={colors.mutedForeground} />
      </View>
      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          color: colors.foreground,
          textAlign: 'center',
          fontSize: variant === 'compact' ? 16 : 18,
        }}
      >
        {title}
      </Text>
      {description && (
        <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: theme.spacing.sm, fontSize: 14 }}>
          {description}
        </Text>
      )}
      {action && <View style={{ marginTop: theme.spacing.xl, width: '100%' }}>{action}</View>}
      {!action && actionLabel && onAction && (
        <View style={{ marginTop: theme.spacing.xl }}>
          <Button variant="accent" size="sm" onPress={onAction}>
            {actionLabel}
          </Button>
        </View>
      )}
    </View>
  );
}
