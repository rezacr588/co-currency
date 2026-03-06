import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp, TrendingDown, ArrowRight, RefreshCw } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency } from '../../../utils/format';
import { haptics } from '../../../utils/haptics';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';

interface WeeklyRecapCardProps {
  compact?: boolean;
}

export function WeeklyRecapCard({ compact = false }: WeeklyRecapCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const { reportTimeZone } = useReportTimeZone();

  // Fetch weekly recap data (ISO 8601 Monday-Sunday)
  const {
    data: weeklyRecap,
    isPending: isLoadingRecap,
    refetch: refetchRecap,
    isRefetching,
  } = useQuery({
    queryKey: ['reports', 'weekly-recap', reportTimeZone],
    queryFn: () => api.reports.weeklyRecap(undefined, undefined, reportTimeZone),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  // Fetch AI insights as secondary display
  const { data: insights, isPending: isLoadingInsights } = useQuery({
    queryKey: ['reports', 'insights', reportTimeZone],
    queryFn: () => api.reports.insights(undefined, reportTimeZone),
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
        style={{ cursor: 'pointer', backgroundColor: colors.accent + '1a', borderWidth: 1, borderColor: colors.accent + '33', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: colors.accent + '33', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Sparkles size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            {t('weeklyRecap') || 'Weekly Recap'}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
            {t('getPersonalizedInsights') || 'Get personalized insights'}
          </Text>
        </View>
        <ArrowRight size={18} color={colors.accent} />
      </Pressable>
    );
  }

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: colors.accent + '33', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Sparkles size={20} color={colors.accent} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {t('weeklyRecap') || 'Weekly Recap'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {weeklyRecap
                ? `${formatShortDate(weeklyRecap.week_start)} – ${formatShortDate(weeklyRecap.week_end)}`
                : t('aiPoweredInsights') || 'AI-powered insights'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleRefresh}
          disabled={isLoading}
          style={{ cursor: 'pointer', padding: 8 }}
        >
          <RefreshCw
            size={18}
            color={colors.mutedForeground}
            style={isLoading ? { opacity: 0.5 } : undefined}
          />
        </Pressable>
      </View>

      {/* Weekly Stats Row */}
      {weeklyRecap && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <View style={{ width: '48%', backgroundColor: colors.muted + '80', padding: 12, borderRadius: 8 }}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>
              {t('totalIncome')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TrendingUp size={14} color={colors.success} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginLeft: 4 }}>
                {formatCompactCurrency(weeklyRecap.total_income, weeklyRecap.currency)}
              </Text>
            </View>
          </View>

          <View style={{ width: '48%', backgroundColor: colors.muted + '80', padding: 12, borderRadius: 8 }}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>
              {t('totalExpenses')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TrendingDown size={14} color={colors.danger} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginLeft: 4 }}>
                {formatCompactCurrency(weeklyRecap.total_spent, weeklyRecap.currency)}
              </Text>
            </View>
          </View>

          <View style={{ width: '48%', backgroundColor: colors.muted + '80', padding: 12, borderRadius: 8 }}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>
              {t('expensesVsLastWeek') || 'Expenses vs last week'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {weeklyRecap.compared_to_last <= 0 ? (
                <TrendingDown size={14} color={colors.success} />
              ) : (
                <TrendingUp size={14} color={colors.danger} />
              )}
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Inter_600SemiBold',
                  marginLeft: 4,
                  color: weeklyRecap.compared_to_last <= 0 ? colors.success : colors.danger,
                }}
              >
                {`${weeklyRecap.compared_to_last < 0 ? '' : '+'}${Math.round(weeklyRecap.compared_to_last)}%`}
              </Text>
            </View>
          </View>

          <View style={{ width: '48%', backgroundColor: colors.muted + '80', padding: 12, borderRadius: 8 }}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>
              {t('savingsRate') || 'Savings Rate'}
            </Text>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {weeklyRecap.total_income > 0
                ? Math.round(((weeklyRecap.total_income - weeklyRecap.total_spent) / weeklyRecap.total_income) * 100)
                : 0}%
            </Text>
          </View>
        </View>
      )}

      {/* AI Insights */}
      {isLoadingInsights ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
            {t('generatingInsights') || 'Generating insights...'}
          </Text>
        </View>
      ) : insights ? (
        <View style={{ marginBottom: 16 }}>
          <View
            style={{
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
              backgroundColor: insights.sentiment === 'positive'
                ? colors.success + '1a'
                : insights.sentiment === 'negative'
                  ? colors.danger + '1a'
                  : colors.muted,
              borderWidth: 1,
              borderColor: insights.sentiment === 'positive'
                ? colors.success + '33'
                : insights.sentiment === 'negative'
                  ? colors.danger + '33'
                  : colors.border,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>
              {insights.advice}
            </Text>
          </View>

          {insights.action_items && insights.action_items.length > 0 && (
            <View>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8, fontFamily: 'Inter_500Medium' }}>
                {t('actionItems') || 'Action Items'}:
              </Text>
              {insights.action_items.slice(0, 3).map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                  <Text style={{ color: colors.accent, marginRight: 8 }}>•</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={{ backgroundColor: colors.muted + '80', padding: 16, borderRadius: 8, marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: 'center' }}>
            {t('noInsightsYet') || 'Add some transactions to get AI-powered insights'}
          </Text>
        </View>
      )}

      {/* Ask AI Button */}
      <Pressable
        onPress={handleAskAI}
        style={{ cursor: 'pointer', backgroundColor: colors.accent, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
      >
        <Sparkles size={18} color="#09090b" />
        <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>
          {t('askForDetailedRecap') || 'Ask AI for Detailed Recap'}
        </Text>
      </Pressable>
    </View>
  );
}
