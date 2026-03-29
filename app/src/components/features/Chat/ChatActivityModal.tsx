import { memo } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Activity } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';
import { EmptyState } from '../../ui/EmptyState';
import type { ChatStreamTraceEvent } from '../../../api/chat';

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  search_transactions: 'Transactions API',
  get_monthly_report: 'Monthly Report API',
  get_category_report: 'Category Report API',
  get_spending_trends: 'Spending Trends API',
  get_financial_forecast: 'Forecast API',
  get_health_score: 'Health Score API',
  get_subscriptions: 'Subscriptions API',
  search_notes: 'Notes Search API',
  web_search: 'Web Search API',
};

function getToolDisplayName(toolName: string): string {
  if (!toolName) return 'Tool';
  if (TOOL_DISPLAY_NAMES[toolName]) {
    return TOOL_DISPLAY_NAMES[toolName];
  }
  return toolName
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export type ToolUsageItem = {
  name: string;
  count: number;
};

export interface ChatActivityModalProps {
  visible: boolean;
  onClose: () => void;
  traceEvents: ChatStreamTraceEvent[];
  toolUsage: ToolUsageItem[];
}

export const ChatActivityModal = memo(function ChatActivityModal({
  visible,
  onClose,
  traceEvents,
  toolUsage,
}: ChatActivityModalProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: '82%', backgroundColor: colors.background, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 }}>Agent Activity</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.mutedForeground }}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: Math.max(insets.bottom, 18) }}>
            {traceEvents.length === 0 && toolUsage.length === 0 ? (
              <EmptyState
                icon={Activity}
                title={t('noActivity') || 'No activity'}
                description="No workflow events yet. Send a message to start capturing agent steps."
                variant="compact"
              />
            ) : (
              <View>
                {toolUsage.length > 0 ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      backgroundColor: colors.card,
                      padding: 10,
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                      Tools Used
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {toolUsage.map((tool) => (
                        <View
                          key={`active-tool-${tool.name}`}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.secondary,
                          }}
                        >
                          <Text style={{ color: colors.foreground, fontSize: 11 }}>
                            {getToolDisplayName(tool.name)}
                            {tool.count > 1 ? ` ×${tool.count}` : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {traceEvents.map((event, index) => (
                  <View
                    key={`${event.sequence_id || index}-${event.stage || event.step || index}`}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      backgroundColor: colors.card,
                      padding: 10,
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                      {event.stage || event.step || 'event'}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                      #{event.sequence_id || index + 1}
                      {event.timestamp ? ` · ${new Date(event.timestamp).toLocaleTimeString()}` : ''}
                    </Text>
                    {event.tool_name ? (
                      <Text style={{ color: colors.foreground, fontSize: 12, marginTop: 6 }}>
                        Tool: {getToolDisplayName(String(event.tool_name))}
                      </Text>
                    ) : null}
                    {event.duration_ms ? (
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                        Duration: {String(event.duration_ms)} ms
                      </Text>
                    ) : null}
                    {event.error ? (
                      <Text style={{ color: colors.danger, fontSize: 11, marginTop: 4 }}>
                        Error: {String(event.error)}
                      </Text>
                    ) : null}
                    {event.raw ? (
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 6 }} numberOfLines={8}>
                        {JSON.stringify(event.raw)}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});
