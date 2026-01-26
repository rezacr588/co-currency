import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <View className="bg-card p-8 rounded-xl items-center">
      <Icon size={48} color="rgb(148, 163, 184)" />
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
