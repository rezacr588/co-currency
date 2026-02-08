import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp, TrendingDown, ArrowRight, RefreshCw } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { formatCompactCurrency } from '../../../utils/format';
import { haptics } from '../../../utils/haptics';

interface WeeklyRecapCardProps {
  compact?: boolean;
}

export function WeeklyRecapCard({ compact = false }: WeeklyRecapCardProps) {
  const { t } = useLanguage();
  const router = useRouter();

  // Fetch weekly recap data (ISO 8601 Monday–Sunday)
  const {
    data: weeklyRecap,
    isPending: isLoadingRecap,
    refetch: refetchRecap,
    isRefetching,
  } = useQuery({
    queryKey: ['reports', 'weekly-recap'],
    queryFn: () => api.reports.weeklyRecap(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  // Fetch AI insights as secondary display
  const { data: insights, isPending: isLoadingInsights } = useQuery({
    queryKey: ['reports', 'insights'],
    queryFn: () => api.reports.insights(),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const handleRefresh = () => {
    haptics.light();
    refetchRecap();
  };

  const handleAskAI = () => {
    haptics.medium();
    router.push({
      pathname: '/(app)/(tabs)/wallet/chat',
      params: { prompt: 'Give me a detailed weekly spending recap and personalized advice.' },
    });
  };

  const formatShortDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isLoading = isLoadingRecap || isRefetching;

  if (compact) {
    return (
      <Pressable
        onPress={handleAskAI}
        style={{ cursor: 'pointer' }}
        className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 p-4 rounded-xl flex-row items-center"
      >
        <View className="w-10 h-10 rounded-full bg-accent/20 items-center justify-center mr-3">
          <Sparkles size={20} color="rgb(212, 175, 55)" />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-semibold">
            {t('weeklyRecap') || 'Weekly Recap'}
          </Text>
          <Text className="text-muted-foreground text-sm">
            {t('getPersonalizedInsights') || 'Get personalized insights'}
          </Text>
        </View>
        <ArrowRight size={18} color="rgb(212, 175, 55)" />
      </Pressable>
    );
  }

  return (
    <View className="bg-card border border-border p-5 rounded-xl">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-accent/20 items-center justify-center mr-3">
            <Sparkles size={20} color="rgb(212, 175, 55)" />
          </View>
          <View>
            <Text className="text-base font-semibold text-foreground">
              {t('weeklyRecap') || 'Weekly Recap'}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {weeklyRecap
                ? `${formatShortDate(weeklyRecap.week_start)} – ${formatShortDate(weeklyRecap.week_end)}`
                : t('aiPoweredInsights') || 'AI-powered insights'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleRefresh}
          disabled={isLoading}
          style={{ cursor: 'pointer' }}
          className="p-2"
        >
          <RefreshCw
            size={18}
            color="#71717a"
            style={isLoading ? { opacity: 0.5 } : undefined}
          />
        </Pressable>
      </View>

      {/* Weekly Stats Row */}
      {weeklyRecap && (
        <View className="flex-row justify-between mb-4 bg-muted/50 p-3 rounded-lg">
          <View className="items-center flex-1">
            <Text className="text-xs text-muted-foreground mb-1">
              {t('thisWeek') || 'This Week'}
            </Text>
            <View className="flex-row items-center">
              <TrendingDown size={14} color="#ef4444" />
              <Text className="text-sm font-semibold text-foreground ml-1">
                {formatCompactCurrency(weeklyRecap.total_spent, weeklyRecap.currency)}
              </Text>
            </View>
          </View>
          {weeklyRecap.compared_to_last !== 0 && (
            <View className="items-center flex-1">
              <Text className="text-xs text-muted-foreground mb-1">
                {t('vsLastWeek') || 'vs Last Week'}
              </Text>
              <View className="flex-row items-center">
                {weeklyRecap.compared_to_last <= 0 ? (
                  <TrendingDown size={14} color="#22c55e" />
                ) : (
                  <TrendingUp size={14} color="#ef4444" />
                )}
                <Text
                  className={`text-sm font-semibold ml-1 ${
                    weeklyRecap.compared_to_last <= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {`${weeklyRecap.compared_to_last < 0 ? '' : '+'}${Math.round(weeklyRecap.compared_to_last)}%`}
                </Text>
              </View>
            </View>
          )}
          <View className="items-center flex-1">
            <Text className="text-xs text-muted-foreground mb-1">
              {t('savingsRate') || 'Savings'}
            </Text>
            <Text className="text-sm font-semibold text-foreground">
              {weeklyRecap.total_income > 0
                ? Math.round(((weeklyRecap.total_income - weeklyRecap.total_spent) / weeklyRecap.total_income) * 100)
                : 0}%
            </Text>
          </View>
        </View>
      )}

      {/* AI Insights */}
      {isLoadingInsights ? (
        <View className="items-center py-4">
          <ActivityIndicator color="rgb(212, 175, 55)" />
          <Text className="text-muted-foreground text-sm mt-2">
            {t('generatingInsights') || 'Generating insights...'}
          </Text>
        </View>
      ) : insights ? (
        <View className="mb-4">
          <View
            className={`p-3 rounded-lg mb-3 ${
              insights.sentiment === 'positive'
                ? 'bg-success/10 border border-success/20'
                : insights.sentiment === 'negative'
                  ? 'bg-danger/10 border border-danger/20'
                  : 'bg-muted border border-border'
            }`}
          >
            <Text className="text-foreground text-sm leading-relaxed">
              {insights.advice}
            </Text>
          </View>

          {insights.action_items && insights.action_items.length > 0 && (
            <View>
              <Text className="text-xs text-muted-foreground mb-2 font-medium">
                {t('actionItems') || 'Action Items'}:
              </Text>
              {insights.action_items.slice(0, 3).map((item, idx) => (
                <View key={idx} className="flex-row items-start mb-1">
                  <Text className="text-accent mr-2">•</Text>
                  <Text className="text-foreground text-sm flex-1">{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View className="bg-muted/50 p-4 rounded-lg mb-4 items-center">
          <Text className="text-muted-foreground text-sm text-center">
            {t('noInsightsYet') || 'Add some transactions to get AI-powered insights'}
          </Text>
        </View>
      )}

      {/* Ask AI Button */}
      <Pressable
        onPress={handleAskAI}
        style={{ cursor: 'pointer' }}
        className="bg-accent p-3 rounded-lg flex-row items-center justify-center"
      >
        <Sparkles size={18} color="#09090b" />
        <Text className="text-accent-foreground font-semibold ml-2">
          {t('askForDetailedRecap') || 'Ask AI for Detailed Recap'}
        </Text>
      </Pressable>
    </View>
  );
}
