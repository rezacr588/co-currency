import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { ICON_SIZES } from '../../constants/icons';
import { useColors } from '../../context/ThemeContext';
import { Button } from './Button';

type EmptyStateVariant = 'default' | 'compact' | 'fullscreen';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Button shorthand — renders an accent Button if provided */
  actionLabel?: string;
  onAction?: () => void;
  /** Icon size - defaults to 'xl' (48px) for empty states */
  iconSize?: keyof typeof ICON_SIZES | number;
  /** Layout variant */
  variant?: EmptyStateVariant;
}

const variantPadding: Record<EmptyStateVariant, string> = {
  default: 'p-8',
  compact: 'p-5',
  fullscreen: 'p-8 flex-1',
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
  const colors = useColors();
  const size = typeof iconSize === 'number' ? iconSize : ICON_SIZES[iconSize];

  return (
    <View
      className={`bg-card rounded-xl items-center justify-center ${variantPadding[variant]}`}
    >
      <View
        style={{
          backgroundColor: colors.muted,
          borderRadius: 16,
          padding: variant === 'compact' ? 10 : 14,
          marginBottom: variant === 'compact' ? 12 : 16,
        }}
      >
        <Icon size={size} color={colors.mutedForeground} />
      </View>
      <Text
        className={`font-semibold text-foreground text-center ${
          variant === 'compact' ? 'text-base' : 'text-lg'
        }`}
      >
        {title}
      </Text>
      {description && (
        <Text className="text-muted-foreground text-center mt-2 text-sm">
          {description}
        </Text>
      )}
      {action && <View className="mt-5 w-full">{action}</View>}
      {!action && actionLabel && onAction && (
        <View className="mt-5">
          <Button variant="accent" size="sm" onPress={onAction}>
            {actionLabel}
          </Button>
        </View>
      )}
    </View>
  );
}
