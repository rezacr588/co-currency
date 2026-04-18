import { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, TrendingUp, TrendingDown, Lightbulb, CheckCircle, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { buildDateKey, getTimeZoneDateParts, shiftCalendarDate } from '../../../utils/dateRange';
import { formatCompactCurrency, formatNumber } from '../../../utils/format';
import { CATEGORY_COLORS, StyledCategoryIcon } from '../../../constants/icons';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';
import { Card } from '../../ui';
import { EmptyState } from '../../ui/EmptyState';
import { ReportErrorCard } from '../../ui';
import { SkeletonCard, SkeletonList } from '../../ui/Skeleton';
import { ReportHeadlineCard } from './ReportHeadlineCard';
import { REPORT_QUERY_RETRY, REPORT_QUERY_STALE_TIME_MS } from './queryConfig';
import { formatReportDateRange, type ReportHistoryTarget } from './reportUX';

interface WeeklyReportViewProps {
  isTablet?: boolean;
  onOpenHistory?: (target: ReportHistoryTarget) => void;
}

export function WeeklyReportView({ isTablet = false, onOpenHistory }: WeeklyReportViewProps) {
  const { t, language } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { reportTimeZone } = useReportTimeZone();
  const [weekOffset, setWeekOffset] = useState(0);

  const referenceDate = useMemo(() => {
    if (weekOffset === 0) return undefined;
    const today = getTimeZoneDateParts(new Date(), reportTimeZone);
    const target = shiftCalendarDate(today, -weekOffset * 7);
    return buildDateKey(target.year, target.month, target.day);
  }, [reportTimeZone, weekOffset]);

  const { data: weeklyRecap, isPending, isError, refetch } = useQuery({
    queryKey: ['reports', 'weekly-recap', weekOffset, reportTimeZone],
    queryFn: () => api.reports.weeklyRecap(undefined, referenceDate, reportTimeZone),
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  if (isPending) {
    return (
      <View style={{ gap: 12 }}>
        <SkeletonCard />
        <SkeletonList count={2} />
      </View>
    );
  }

  if (isError) {
    return (
      <ReportErrorCard
        title={t('failedToLoadReport')}
        message={t('checkConnection')}
        retryLabel={t('retry') || 'Retry'}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (!weeklyRecap) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t('emptyNoReportsTitle') || 'No data for this period'}
        description={t('emptyNoReportsDesc') || 'Add transactions in this range to see reports.'}
      />
    );
  }

  const comparePercent = weeklyRecap.compared_to_last;
  const isPositiveCompare = comparePercent < 0; // Spending less is positive

  // Format week range label
  const weekLabel = weekOffset === 0
    ? t('currentWeek')
    : formatReportDateRange(weeklyRecap.week_start, weeklyRecap.week_end, language, reportTimeZone);
  const summaryTitle = weekOffset === 0 ? t('thisWeek') : weekLabel;
  const headlineSummary = comparePercent < 0
    ? `${formatNumber(Math.abs(comparePercent), 1)}% ${t('lowerExpenseThanLastWeek') || 'lower expenses than last week'}`
    : comparePercent > 0
      ? `${formatNumber(comparePercent, 1)}% ${t('higherExpenseThanLastWeek') || 'higher expenses than last week'}`
      : t('weeklySpendFlat') || 'Spending is close to last week.';
  const rangeTarget = {
    fromDate: weeklyRecap.week_start,
    toDate: weeklyRecap.week_end,
  };

  return (
    <View>
      <ReportHeadlineCard
        summary={headlineSummary}
        caption={
          weekOffset === 0
            ? t('currentWeekSnapshot') || 'Current week snapshot'
            : t('historicalWeekSnapshot') || 'Historical week snapshot'
        }
      />

      {/* Week Navigation */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Pressable
          onPress={() => setWeekOffset(weekOffset + 1)}
          style={{ padding: theme.spacing.sm, borderRadius: theme.radii.sm, backgroundColor: colors.secondary }}
          accessibilityRole="button"
          accessibilityLabel={t('previousWeek')}
          accessibilityHint="Show previous weekly report"
          hitSlop={8}
        >
          <ChevronLeft size={20} color={colors.mutedForeground} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1, marginHorizontal: theme.spacing.md }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }} numberOfLines={1}>
            {weekLabel}
          </Text>
          {weekOffset > 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: theme.spacing.xs }}>
              {t('historicalWeek') || 'Historical week'}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => weekOffset > 0 && setWeekOffset(weekOffset - 1)}
          style={{ padding: theme.spacing.sm, borderRadius: theme.radii.sm, backgroundColor: weekOffset === 0 ? theme.alpha(colors.secondary, 0.3) : colors.secondary, opacity: weekOffset === 0 ? 0.3 : 1 }}
          disabled={weekOffset === 0}
          accessibilityRole="button"
          accessibilityLabel={t('nextWeek')}
          accessibilityHint="Show next weekly report"
          hitSlop={8}
        >
          <ChevronRight size={20} color={colors.mutedForeground} />
        </Pressable>
      </Card>

      {/* Weekly Summary Card */}
      <Card style={{ padding: theme.spacing.xxl, marginBottom: theme.spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ backgroundColor: theme.alpha(colors.accent, 0.2), padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
              <Calendar size={20} color={colors.accent} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{summaryTitle}</Text>
          </View>

          {/* Week over Week Comparison */}
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 6,
              borderRadius: theme.radii.full,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isPositiveCompare ? theme.alpha(colors.success, 0.2) : comparePercent > 0 ? theme.alpha(colors.danger, 0.2) : colors.secondary,
            }}
          >
            {comparePercent !== 0 && (
              isPositiveCompare ? (
                <TrendingDown size={14} color={colors.success} />
              ) : (
                <TrendingUp size={14} color={colors.danger} />
              )
            )}
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Inter_600SemiBold',
                marginStart: theme.spacing.xs,
                color: isPositiveCompare ? colors.success : comparePercent > 0 ? colors.danger : colors.mutedForeground,
              }}
            >
              {comparePercent > 0 ? '+' : ''}{formatNumber(comparePercent, 1)}% {t('expensesVsLastWeek') || 'Expenses vs last week'}
            </Text>
          </View>
        </View>

        <View style={{
          flexDirection: isTablet ? 'row' : 'column',
          gap: theme.spacing.md,
        }}>
          {/* Total Income */}
          <View style={{ flex: 1, backgroundColor: theme.alpha(colors.success, 0.1), borderWidth: 1, borderColor: theme.alpha(colors.success, 0.3), padding: theme.spacing.lg, borderRadius: theme.radii.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
              <TrendingUp size={16} color={colors.success} />
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginStart: theme.spacing.sm }}>{t('totalIncome')}</Text>
            </View>
            <Text style={{ color: colors.success, fontSize: 24, fontFamily: 'Inter_700Bold' }}>
              {formatCompactCurrency(weeklyRecap.total_income, weeklyRecap.currency)}
            </Text>
          </View>

          {/* Total Spent */}
          <View style={{ flex: 1, backgroundColor: theme.alpha(colors.danger, 0.1), borderWidth: 1, borderColor: theme.alpha(colors.danger, 0.3), padding: theme.spacing.lg, borderRadius: theme.radii.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
              <TrendingDown size={16} color={colors.danger} />
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginStart: theme.spacing.sm }}>{t('totalExpenses')}</Text>
            </View>
            <Text style={{ color: colors.danger, fontSize: 24, fontFamily: 'Inter_700Bold' }}>
              {formatCompactCurrency(weeklyRecap.total_spent, weeklyRecap.currency)}
            </Text>
          </View>
        </View>

        {/* Net Change */}
        <View style={{ marginTop: theme.spacing.lg, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.lg, borderRadius: theme.radii.sm }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: theme.spacing.xs }}>{t('net')}</Text>
          <Text
            style={{
              fontSize: 24,
              fontFamily: 'Inter_700Bold',
              color: weeklyRecap.net_change >= 0 ? colors.success : colors.danger,
            }}
          >
            {weeklyRecap.net_change >= 0 ? '+' : ''}{formatCompactCurrency(weeklyRecap.net_change, weeklyRecap.currency)}
          </Text>
        </View>

        {onOpenHistory ? (
          <Pressable
            onPress={() => onOpenHistory(rangeTarget)}
            style={({ pressed }) => ({
              marginTop: theme.spacing.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
              borderRadius: 10,
              paddingVertical: theme.spacing.md,
              opacity: pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={t('viewThisWeek') || 'View this week'}
          >
            <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold' }}>
              {t('viewThisWeek') || 'View this week'}
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {/* Top Categories */}
      {weeklyRecap.top_categories && weeklyRecap.top_categories.length > 0 && (
        <Card style={{ padding: theme.spacing.xxl, marginBottom: theme.spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <View style={{ backgroundColor: colors.secondary, padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
              <Calendar size={20} color={colors.mutedForeground} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('topCategories')}</Text>
          </View>

          <View style={{ gap: theme.spacing.md }}>
            {weeklyRecap.top_categories.slice(0, 5).map((cat, index) => {
              const maxAmount = weeklyRecap.top_categories[0]?.amount || 1;
              const barWidth = (cat.amount / maxAmount) * 100;
              const categoryColor = CATEGORY_COLORS[cat.category.toLowerCase()] || colors.accent;

              return (
                <Pressable
                  key={cat.category}
                  onPress={() => onOpenHistory?.({ ...rangeTarget, category: cat.category })}
                  disabled={!onOpenHistory}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.82 : 1,
                  })}
                  accessibilityRole={onOpenHistory ? 'button' : undefined}
                  accessibilityLabel={`${t('topCategory') || 'Top category'} ${cat.category}`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <StyledCategoryIcon
                        category={cat.category}
                        size={14}
                        backgroundOpacity={0.15}
                        borderRadius={6}
                        padding={6}
                      />
                      <Text style={{ color: colors.foreground, fontSize: 14, textTransform: 'capitalize', marginStart: theme.spacing.sm }}>{cat.category}</Text>
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
                      {formatCompactCurrency(cat.amount, weeklyRecap.currency)}
                    </Text>
                  </View>
                  <View style={{ height: 12, backgroundColor: colors.secondary, borderRadius: theme.radii.full, overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        borderRadius: theme.radii.full,
                        width: `${barWidth}%`,
                        backgroundColor: categoryColor,
                      }}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      {/* Weekly Insights */}
      {weeklyRecap.insights && weeklyRecap.insights.length > 0 && (
        <Card style={{ padding: theme.spacing.xxl, marginBottom: theme.spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.alpha(colors.accent, 0.2), padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
              <Lightbulb size={20} color={colors.accent} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('weeklyInsights')}</Text>
          </View>

          <View style={{ gap: theme.spacing.md }}>
            {weeklyRecap.insights.map((insight, index) => (
              <View
                key={index}
                style={{ backgroundColor: theme.alpha(colors.secondary, 0.3), padding: theme.spacing.md, borderRadius: theme.radii.sm, flexDirection: 'row', alignItems: 'flex-start' }}
              >
                <View style={{ width: 24, height: 24, borderRadius: theme.radii.full, backgroundColor: theme.alpha(colors.accent, 0.2), alignItems: 'center', justifyContent: 'center', marginEnd: theme.spacing.md, marginTop: 2 }}>
                  <Text style={{ color: colors.accent, fontSize: 12, fontFamily: 'Inter_700Bold' }}>{index + 1}</Text>
                </View>
                <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>{insight}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Action Items */}
      {weeklyRecap.action_items && weeklyRecap.action_items.length > 0 && (
        <Card style={{ padding: theme.spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.alpha(colors.success, 0.2), padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
              <CheckCircle size={20} color={colors.success} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('actionItems')}</Text>
          </View>

          <View style={{ gap: theme.spacing.md }}>
            {weeklyRecap.action_items.map((item, index) => (
              <View
                key={index}
                style={{ backgroundColor: theme.alpha(colors.success, 0.05), borderWidth: 1, borderColor: theme.alpha(colors.success, 0.2), padding: theme.spacing.md, borderRadius: theme.radii.sm, flexDirection: 'row', alignItems: 'flex-start' }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.success, marginEnd: theme.spacing.md, marginTop: 2 }} />
                <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>{item}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}
