import { Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';
import { PageHeader } from '../../ui';
import { ChatOverflowMenu } from './ChatOverflowMenu';

interface ChatHeaderProps {
  aiConfigured: boolean;
  aiRateLimitPerMinute: number;
  onNewConversation: () => void;
  onActivityPress: () => void;
  onUsagePress: () => void;
  onExportPress?: () => void;
  onClearHistoryPress?: () => void;
  contentWidthStyle?: Record<string, any>;
}

export function ChatHeader({
  aiConfigured,
  aiRateLimitPerMinute,
  onNewConversation,
  onActivityPress,
  onUsagePress,
  onExportPress,
  onClearHistoryPress,
  contentWidthStyle,
}: ChatHeaderProps) {
  const theme = useTheme();
  const { t } = useLanguage();

  return (
    <View
      style={[
        {
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        },
        contentWidthStyle,
      ]}
    >
      <PageHeader
        title="CoAI"
        subtitle={
          aiConfigured
            ? `${t('alwaysReady') || 'Always ready'} · ${aiRateLimitPerMinute}/min`
            : 'Offline'
        }
        actions={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ChatOverflowMenu
              onActivityPress={onActivityPress}
              onUsagePress={onUsagePress}
              onExportPress={onExportPress}
              onClearHistoryPress={onClearHistoryPress}
            />
            <Pressable
              onPress={onNewConversation}
              accessibilityRole="button"
              accessibilityLabel={t('newConversation') || 'New chat'}
              hitSlop={8}
              style={({ pressed }) => [
                {
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Plus size={16} color={theme.colors.primaryForeground} />
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Inter_600SemiBold',
                  color: theme.colors.primaryForeground,
                }}
              >
                {t('newChat') || 'New Chat'}
              </Text>
            </Pressable>
          </View>
        }
        style={{ marginBottom: 0 }}
      />
    </View>
  );
}
