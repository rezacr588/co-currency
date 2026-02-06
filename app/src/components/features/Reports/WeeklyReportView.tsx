import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, TrendingUp, TrendingDown, Lightbulb, CheckCircle, AlertCircle } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { formatCompactCurrency, formatNumber } from '../../../utils/format';
import { safeMax } from '../../../utils/dateRange';
import { CATEGORY_COLORS, StyledCategoryIcon } from '../../../constants/icons';
import type { WeeklyRecapReport } from '../../../types/goal';

interface WeeklyReportViewProps {
  isTablet?: boolean;
}

export function WeeklyReportView({ isTablet = false }: WeeklyReportViewProps) {
  const { t } = useLanguage();

  const { data: weeklyRecap, isPending, isError } = useQuery({
    queryKey: ['reports', 'weekly-recap'],
    queryFn: () => api.reports.weeklyRecap(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  if (isPending) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="bg-card p-6 rounded-xl items-center">
        <AlertCircle size={48} color="rgb(220, 38, 38)" />
        <Text className="text-foreground font-semibold mt-4 text-lg">{t('failedToLoadReport')}</Text>
        <Text className="text-muted-foreground mt-2 text-center">{t('checkConnection')}</Text>
      </View>
    );
  }

  if (!weeklyRecap) {
    return (
      <View className="bg-card p-8 rounded-xl items-center">
        <Calendar size={48} color="rgb(71, 71, 71)" />
        <Text className="text-foreground font-semibold mt-4 text-lg">{t('noDataAvailable')}</Text>
        <Text className="text-muted-foreground mt-2 text-center">
          {t('addTransaction')}
        </Text>
      </View>
    );
  }

  const comparePercent = weeklyRecap.compared_to_last;
  const isPositiveCompare = comparePercent < 0; // Spending less is positive

  return (
    <View>
      {/* Weekly Summary Card */}
      <View className="bg-card p-6 rounded-xl mb-6">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View className="bg-accent/20 p-2 rounded-lg mr-3">
              <Calendar size={20} color="rgb(212, 175, 55)" />
            </View>
            <Text className="text-foreground font-semibold">{t('thisWeek')}</Text>
          </View>

          {/* Week over Week Comparison */}
          <View
            className={`px-3 py-1.5 rounded-full flex-row items-center ${
              isPositiveCompare ? 'bg-success/20' : comparePercent > 0 ? 'bg-danger/20' : 'bg-secondary'
            }`}
          >
            {comparePercent !== 0 && (
              isPositiveCompare ? (
                <TrendingDown size={14} color="rgb(16, 185, 129)" />
              ) : (
                <TrendingUp size={14} color="rgb(220, 38, 38)" />
              )
            )}
            <Text
              className={`text-sm font-semibold ml-1 ${
                isPositiveCompare ? 'text-success' : comparePercent > 0 ? 'text-danger' : 'text-muted-foreground'
              }`}
            >
              {comparePercent > 0 ? '+' : ''}{formatNumber(comparePercent, 1)}% {t('weekOverWeek')}
            </Text>
          </View>
        </View>

        <View style={{
          flexDirection: isTablet ? 'row' : 'column',
          gap: 12,
        }}>
          {/* Total Income */}
          <View className="flex-1 bg-success/10 border border-success/30 p-4 rounded-xl">
            <View className="flex-row items-center mb-2">
              <TrendingUp size={16} color="rgb(16, 185, 129)" />
              <Text className="text-muted-foreground text-sm ml-2">{t('totalIncome')}</Text>
            </View>
            <Text className="text-success text-2xl font-bold">
              {formatCompactCurrency(weeklyRecap.total_income, weeklyRecap.currency)}
            </Text>
          </View>

          {/* Total Spent */}
          <View className="flex-1 bg-danger/10 border border-danger/30 p-4 rounded-xl">
            <View className="flex-row items-center mb-2">
              <TrendingDown size={16} color="rgb(220, 38, 38)" />
              <Text className="text-muted-foreground text-sm ml-2">{t('totalExpenses')}</Text>
            </View>
            <Text className="text-danger text-2xl font-bold">
              {formatCompactCurrency(weeklyRecap.total_spent, weeklyRecap.currency)}
            </Text>
          </View>
        </View>

        {/* Net Change */}
        <View className="mt-4 bg-secondary/50 p-4 rounded-lg">
          <Text className="text-muted-foreground text-sm mb-1">{t('net')}</Text>
          <Text
            className={`text-2xl font-bold ${
              weeklyRecap.net_change >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {weeklyRecap.net_change >= 0 ? '+' : ''}{formatCompactCurrency(weeklyRecap.net_change, weeklyRecap.currency)}
          </Text>
        </View>
      </View>

      {/* Top Categories */}
      {weeklyRecap.top_categories && weeklyRecap.top_categories.length > 0 && (
        <View className="bg-card p-6 rounded-xl mb-6">
          <View className="flex-row items-center mb-4">
            <View className="bg-secondary p-2 rounded-lg mr-3">
              <Calendar size={20} color="rgb(148, 163, 184)" />
            </View>
            <Text className="text-foreground font-semibold">{t('topCategories')}</Text>
          </View>

          <View className="gap-3">
            {weeklyRecap.top_categories.slice(0, 5).map((cat, index) => {
              const maxAmount = weeklyRecap.top_categories[0]?.amount || 1;
              const barWidth = (cat.amount / maxAmount) * 100;
              const categoryColor = CATEGORY_COLORS[cat.category.toLowerCase()] || 'rgb(212, 175, 55)';

              return (
                <View key={cat.category}>
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center">
                      <StyledCategoryIcon
                        category={cat.category}
                        size={14}
                        backgroundOpacity={0.15}
                        borderRadius={6}
                        padding={6}
                      />
                      <Text className="text-foreground text-sm capitalize ml-2">{cat.category}</Text>
                    </View>
                    <Text className="text-muted-foreground text-sm font-medium">
                      {formatCompactCurrency(cat.amount, weeklyRecap.currency)}
                    </Text>
                  </View>
                  <View className="h-3 bg-secondary rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: categoryColor,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Weekly Insights */}
      {weeklyRecap.insights && weeklyRecap.insights.length > 0 && (
        <View className="bg-card p-6 rounded-xl mb-6">
          <View className="flex-row items-center mb-4">
            <View className="bg-accent/20 p-2 rounded-lg mr-3">
              <Lightbulb size={20} color="rgb(212, 175, 55)" />
            </View>
            <Text className="text-foreground font-semibold">{t('weeklyInsights')}</Text>
          </View>

          <View className="gap-3">
            {weeklyRecap.insights.map((insight, index) => (
              <View
                key={index}
                className="bg-secondary/30 p-3 rounded-lg flex-row items-start"
              >
                <View className="w-6 h-6 rounded-full bg-accent/20 items-center justify-center mr-3 mt-0.5">
                  <Text className="text-accent text-xs font-bold">{index + 1}</Text>
                </View>
                <Text className="text-foreground text-sm flex-1">{insight}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Action Items */}
      {weeklyRecap.action_items && weeklyRecap.action_items.length > 0 && (
        <View className="bg-card p-6 rounded-xl">
          <View className="flex-row items-center mb-4">
            <View className="bg-success/20 p-2 rounded-lg mr-3">
              <CheckCircle size={20} color="rgb(16, 185, 129)" />
            </View>
            <Text className="text-foreground font-semibold">{t('actionItems')}</Text>
          </View>

          <View className="gap-3">
            {weeklyRecap.action_items.map((item, index) => (
              <View
                key={index}
                className="bg-success/5 border border-success/20 p-3 rounded-lg flex-row items-start"
              >
                <View className="w-5 h-5 rounded border-2 border-success mr-3 mt-0.5" />
                <Text className="text-foreground text-sm flex-1">{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
