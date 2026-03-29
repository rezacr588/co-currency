import { memo } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Coins } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import type { ChatUsageSummary } from '../../../api/chat';

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

function formatUsd(value: number | undefined): string {
  if (!value || Number.isNaN(value)) return '$0.0000';
  return `$${value.toFixed(4)}`;
}

export interface ChatUsageModalProps {
  visible: boolean;
  onClose: () => void;
  usageSummary: ChatUsageSummary | undefined;
  windowDays: 7 | 30;
  onWindowChange: (days: 7 | 30) => void;
  isLoading: boolean;
}

export const ChatUsageModal = memo(function ChatUsageModal({
  visible,
  onClose,
  usageSummary,
  windowDays,
  onWindowChange,
  isLoading,
}: ChatUsageModalProps) {
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
        <View style={{ maxHeight: '84%', backgroundColor: colors.background, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 }}>Usage & Billing</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.mutedForeground }}>Close</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 12 }}>
            {([7, 30] as const).map((days) => {
              const selected = windowDays === days;
              return (
                <Pressable
                  key={days}
                  onPress={() => onWindowChange(days)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? colors.accent + '22' : colors.card,
                  }, pressed && { opacity: 0.75 }]}
                >
                  <Text style={{ color: selected ? colors.accent : colors.foreground, fontSize: 12 }}>{days}d</Text>
                </Pressable>
              );
            })}
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: Math.max(insets.bottom, 18) }}>
            {isLoading ? (
              <View style={{ gap: 10 }}>
                {[0, 1, 2].map((item) => (
                  <View
                    key={`usage-skeleton-${item}`}
                    style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.card }}
                  >
                    <Skeleton width="35%" height={12} style={{ marginBottom: 10 }} />
                    <Skeleton width="55%" height={20} style={{ marginBottom: 8 }} />
                    <Skeleton width="90%" height={12} style={{ marginBottom: 6 }} />
                    <Skeleton width="70%" height={12} />
                  </View>
                ))}
              </View>
            ) : !usageSummary || usageSummary.totals.messages === 0 ? (
              <EmptyState
                icon={Coins}
                title={t('noActivity') || 'No activity'}
                description="No usage data yet. Send a message to see token and billing details."
                variant="compact"
              />
            ) : (
              <View style={{ gap: 10 }}>
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.card }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Messages</Text>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 20 }}>{usageSummary.totals.messages}</Text>
                  <Text style={{ color: colors.foreground, fontSize: 12, marginTop: 6 }}>
                    Tokens: {usageSummary.totals.total_tokens} ({usageSummary.totals.prompt_tokens} in / {usageSummary.totals.completion_tokens} out)
                  </Text>
                  <Text style={{ color: colors.foreground, fontSize: 12, marginTop: 2 }}>
                    Estimated: {formatUsd(usageSummary.totals.estimated_cost_usd)} · Billed: {formatUsd(usageSummary.totals.billed_cost_usd)}
                  </Text>
                </View>

                {usageSummary.by_model.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    No model-level breakdown available yet.
                  </Text>
                ) : (
                  usageSummary.by_model.map((modelUsage) => (
                    <View key={`${modelUsage.provider}-${modelUsage.model}`} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.card }}>
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                        {modelUsage.provider} · {modelUsage.model}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                        {modelUsage.messages} messages · {modelUsage.total_tokens} tokens · {modelUsage.billing_source}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                        Est {formatUsd(modelUsage.estimated_cost_usd)} · Billed {formatUsd(modelUsage.billed_cost_usd)}
                      </Text>
                    </View>
                  ))
                )}

                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.card }}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                    Tool Usage
                  </Text>
                  {(usageSummary.by_tool ?? []).length === 0 ? (
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 6 }}>
                      No tool calls recorded in this period.
                    </Text>
                  ) : (
                    (usageSummary.by_tool ?? []).map((toolUsage) => (
                      <View key={`usage-tool-${toolUsage.name}`} style={{ marginTop: 6 }}>
                        <Text style={{ color: colors.foreground, fontSize: 12 }}>
                          {getToolDisplayName(toolUsage.name)}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>
                          {toolUsage.calls} call{toolUsage.calls === 1 ? '' : 's'} across {toolUsage.messages} message{toolUsage.messages === 1 ? '' : 's'}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});
