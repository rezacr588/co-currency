import { useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, TrendingUp, TrendingDown, Lightbulb, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { buildDateKey, getTimeZoneDateParts, shiftCalendarDate } from '../../../utils/dateRange';
import { formatCompactCurrency, formatNumber } from '../../../utils/format';
import { CATEGORY_COLORS, StyledCategoryIcon } from '../../../constants/icons';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';

interface WeeklyReportViewProps {
  isTablet?: boolean;
}

export function WeeklyReportView({ isTablet = false }: WeeklyReportViewProps) {
  const { t } = useLanguage();
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

  const { data: weeklyRecap, isPending, isError } = useQuery({
    queryKey: ['reports', 'weekly-recap', weekOffset, reportTimeZone],
    queryFn: () => api.reports.weeklyRecap(undefined, referenceDate, reportTimeZone),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  if (isPending) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, alignItems: 'center' }}>
        <AlertCircle size={48} color={colors.danger} />
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 16, fontSize: 18 }}>{t('failedToLoadReport')}</Text>
        <Text style={{ color: colors.mutedForeground, marginTop: 8, textAlign: 'center' }}>{t('checkConnection')}</Text>
      </View>
    );
  }

  if (!weeklyRecap) {
    return (
      <View style={{ backgroundColor: colors.card, padding: 32, borderRadius: 12, alignItems: 'center' }}>
        <Calendar size={48} color={colors.mutedForeground} />
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 16, fontSize: 18 }}>{t('noDataAvailable')}</Text>
        <Text style={{ color: colors.mutedForeground, marginTop: 8, textAlign: 'center' }}>
          {t('addTransaction')}
        </Text>
      </View>
    );
  }

  const comparePercent = weeklyRecap.compared_to_last;
  const isPositiveCompare = comparePercent < 0; // Spending less is positive

  // Format week range label
  const weekLabel = weekOffset === 0
    ? t('currentWeek')
    : `${weeklyRecap.week_start} — ${weeklyRecap.week_end}`;
  const summaryTitle = weekOffset === 0 ? t('thisWeek') : weekLabel;

  return (
    <View>
      {/* Week Navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 }}>
        <Pressable
          onPress={() => setWeekOffset(weekOffset + 1)}
          style={{ padding: 8, borderRadius: 8, backgroundColor: colors.secondary }}
          accessibilityLabel={t('previousWeek')}
        >
          <ChevronLeft size={20} color="#a1a1aa" />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1, marginHorizontal: 12 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }} numberOfLines={1}>
            {weekLabel}
          </Text>
        </View>
        <Pressable
          onPress={() => weekOffset > 0 && setWeekOffset(weekOffset - 1)}
          style={{ padding: 8, borderRadius: 8, backgroundColor: weekOffset === 0 ? colors.secondary + '4d' : colors.secondary, opacity: weekOffset === 0 ? 0.3 : 1 }}
          disabled={weekOffset === 0}
          accessibilityLabel={t('nextWeek')}
        >
          <ChevronRight size={20} color="#a1a1aa" />
        </Pressable>
      </View>

      {/* Weekly Summary Card */}
      <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ backgroundColor: colors.accent + '33', padding: 8, borderRadius: 8, marginRight: 12 }}>
              <Calendar size={20} color={colors.accent} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{summaryTitle}</Text>
          </View>

          {/* Week over Week Comparison */}
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 9999,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isPositiveCompare ? colors.success + '33' : comparePercent > 0 ? colors.danger + '33' : colors.secondary,
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
                marginLeft: 4,
                color: isPositiveCompare ? colors.success : comparePercent > 0 ? colors.danger : colors.mutedForeground,
              }}
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
          <View style={{ flex: 1, backgroundColor: colors.success + '1a', borderWidth: 1, borderColor: colors.success + '4d', padding: 16, borderRadius: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <TrendingUp size={16} color={colors.success} />
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginLeft: 8 }}>{t('totalIncome')}</Text>
            </View>
            <Text style={{ color: colors.success, fontSize: 24, fontFamily: 'Inter_700Bold' }}>
              {formatCompactCurrency(weeklyRecap.total_income, weeklyRecap.currency)}
            </Text>
          </View>

          {/* Total Spent */}
          <View style={{ flex: 1, backgroundColor: colors.danger + '1a', borderWidth: 1, borderColor: colors.danger + '4d', padding: 16, borderRadius: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <TrendingDown size={16} color={colors.danger} />
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginLeft: 8 }}>{t('totalExpenses')}</Text>
            </View>
            <Text style={{ color: colors.danger, fontSize: 24, fontFamily: 'Inter_700Bold' }}>
              {formatCompactCurrency(weeklyRecap.total_spent, weeklyRecap.currency)}
            </Text>
          </View>
        </View>

        {/* Net Change */}
        <View style={{ marginTop: 16, backgroundColor: colors.secondary + '80', padding: 16, borderRadius: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 4 }}>{t('net')}</Text>
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
      </View>

      {/* Top Categories */}
      {weeklyRecap.top_categories && weeklyRecap.top_categories.length > 0 && (
        <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 8, marginRight: 12 }}>
              <Calendar size={20} color={colors.mutedForeground} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('topCategories')}</Text>
          </View>

          <View style={{ gap: 12 }}>
            {weeklyRecap.top_categories.slice(0, 5).map((cat, index) => {
              const maxAmount = weeklyRecap.top_categories[0]?.amount || 1;
              const barWidth = (cat.amount / maxAmount) * 100;
              const categoryColor = CATEGORY_COLORS[cat.category.toLowerCase()] || colors.accent;

              return (
                <View key={cat.category}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <StyledCategoryIcon
                        category={cat.category}
                        size={14}
                        backgroundOpacity={0.15}
                        borderRadius={6}
                        padding={6}
                      />
                      <Text style={{ color: colors.foreground, fontSize: 14, textTransform: 'capitalize', marginLeft: 8 }}>{cat.category}</Text>
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
                      {formatCompactCurrency(cat.amount, weeklyRecap.currency)}
                    </Text>
                  </View>
                  <View style={{ height: 12, backgroundColor: colors.secondary, borderRadius: 9999, overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        borderRadius: 9999,
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
        <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.accent + '33', padding: 8, borderRadius: 8, marginRight: 12 }}>
              <Lightbulb size={20} color={colors.accent} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('weeklyInsights')}</Text>
          </View>

          <View style={{ gap: 12 }}>
            {weeklyRecap.insights.map((insight, index) => (
              <View
                key={index}
                style={{ backgroundColor: colors.secondary + '4d', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'flex-start' }}
              >
                <View style={{ width: 24, height: 24, borderRadius: 9999, backgroundColor: colors.accent + '33', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                  <Text style={{ color: colors.accent, fontSize: 12, fontFamily: 'Inter_700Bold' }}>{index + 1}</Text>
                </View>
                <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>{insight}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Action Items */}
      {weeklyRecap.action_items && weeklyRecap.action_items.length > 0 && (
        <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.success + '33', padding: 8, borderRadius: 8, marginRight: 12 }}>
              <CheckCircle size={20} color={colors.success} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('actionItems')}</Text>
          </View>

          <View style={{ gap: 12 }}>
            {weeklyRecap.action_items.map((item, index) => (
              <View
                key={index}
                style={{ backgroundColor: colors.success + '0d', borderWidth: 1, borderColor: colors.success + '33', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'flex-start' }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.success, marginRight: 12, marginTop: 2 }} />
                <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
