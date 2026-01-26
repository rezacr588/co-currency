import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { ICON_SIZES, ICON_COLOR_MUTED } from '../../constants/icons';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Icon size - defaults to 'xl' (48px) for empty states */
  iconSize?: keyof typeof ICON_SIZES | number;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  iconSize = 'xl',
}: EmptyStateProps) {
  const size = typeof iconSize === 'number' ? iconSize : ICON_SIZES[iconSize];

  return (
    <View className="bg-card p-8 rounded-xl items-center">
      <Icon size={size} color={ICON_COLOR_MUTED} />
      <Text className="text-lg font-semibold text-foreground mt-4 text-center">
        {title}
      </Text>
      {description && (
        <Text className="text-muted-foreground text-center mt-2">
          {description}
        </Text>
      )}
      {action && <View className="mt-6">{action}</View>}
    </View>
  );
}
