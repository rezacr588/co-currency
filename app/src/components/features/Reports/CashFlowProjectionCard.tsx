import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, AlertTriangle, Calendar, ArrowDown } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useColors } from '../../../context/ThemeContext';
import { formatCompactCurrency, formatNumber } from '../../../utils/format';
import type { CashFlowReport } from '../../../types/goal';

export function CashFlowProjectionCard() {
  const { t } = useLanguage();
  const colors = useColors();

  const { data: report, isPending } = useQuery({
    queryKey: ['reports', 'cashflow'],
    queryFn: () => api.reports.cashflow(30),
    staleTime: 5 * 60 * 1000,
  });

  if (isPending || !report) return null;

  const projections = report.projections || [];
  if (projections.length === 0) return null;

  // Calculate chart dimensions
  const allBalances = [report.current_balance, ...projections.map((p) => p.balance)];
  const maxBalance = Math.max(...allBalances);
  const minBalance = Math.min(...allBalances);
  const range = maxBalance - minBalance || 1;
  const chartHeight = 120;

  // Sample points for the chart (show every Nth day to fit)
  const step = Math.max(1, Math.floor(projections.length / 15));
  const sampledPoints = projections.filter((_, i) => i % step === 0 || i === projections.length - 1);

  // Collect upcoming events from next 5 days
  const upcomingEvents = projections
    .slice(0, 7)
    .flatMap((p) =>
      (p.events || []).map((e) => ({
        ...e,
        date: p.date,
      }))
    )
    .slice(0, 5);

  return (
    <View className="bg-card p-6 rounded-xl mb-6">
      {/* Header */}
      <View className="flex-row items-center mb-4">
        <View className="bg-accent/20 p-2 rounded-lg mr-3">
          <TrendingUp size={20} color={colors.accent} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-semibold">
            {t('cashFlowProjection') || 'Cash Flow Projection'}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {report.days_projected} {t('daysProjected') || 'days projected'}
          </Text>
        </View>
      </View>

      {/* Balance Chart */}
      <View style={{ height: chartHeight, marginBottom: 8 }}>
        <View className="flex-row items-end justify-between h-full gap-0.5">
          {sampledPoints.map((point, index) => {
            const normalizedHeight =
              range > 0
                ? ((point.balance - minBalance) / range) * (chartHeight - 20) + 10
                : chartHeight / 2;

            const isNegative = point.balance < 0;
            const isLow =
              report.current_balance > 0
                ? point.balance < report.current_balance * 0.2
                : false;

            return (
              <View key={index} className="flex-1 items-center justify-end h-full">
                <View
                  className="rounded-t"
                  style={{
                    width: '80%',
                    height: Math.max(normalizedHeight, 4),
                    backgroundColor: isNegative
                      ? colors.danger
                      : isLow
                        ? colors.warning
                        : colors.success,
                    opacity: 0.8,
                  }}
                />
              </View>
            );
          })}
        </View>
        {/* X-axis labels */}
        <View className="flex-row justify-between mt-1">
          <Text className="text-muted-foreground text-xs">
            {projections[0]?.date.slice(5) || ''}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {projections[projections.length - 1]?.date.slice(5) || ''}
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View className="flex-row justify-center gap-4 mb-4">
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-success mr-1" />
          <Text className="text-muted-foreground text-xs">{t('healthy') || 'Healthy'}</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: colors.warning }} />
          <Text className="text-muted-foreground text-xs">{t('low') || 'Low'}</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-danger mr-1" />
          <Text className="text-muted-foreground text-xs">{t('negative') || 'Negative'}</Text>
        </View>
      </View>

      {/* Danger Zone Alert */}
      {report.danger_zone && report.danger_date && (
        <View className="bg-danger/10 border border-danger/30 p-4 rounded-xl flex-row items-center mb-4">
          <AlertTriangle size={20} color={colors.danger} />
          <View className="ml-3 flex-1">
            <Text className="text-danger font-medium text-sm">
              {t('dangerZone') || 'Danger Zone'}
            </Text>
            <Text className="text-danger/80 text-xs mt-0.5">
              {t('balanceGoesNegative') || 'Balance projected to go negative on'}{' '}
              {report.danger_date}
            </Text>
          </View>
        </View>
      )}

      {/* Summary Stats */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
          <Text className="text-muted-foreground text-xs mb-1">
            {t('expectedIncome') || 'Expected Income'}
          </Text>
          <Text className="text-success font-bold">
            {formatCompactCurrency(report.summary.expected_income, report.currency)}
          </Text>
        </View>
        <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
          <Text className="text-muted-foreground text-xs mb-1">
            {t('expectedExpenses') || 'Expected Expenses'}
          </Text>
          <Text className="text-danger font-bold">
            {formatCompactCurrency(report.summary.expected_expenses, report.currency)}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3 mb-4">
        <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
          <Text className="text-muted-foreground text-xs mb-1">
            {t('lowestBalance') || 'Lowest Balance'}
          </Text>
          <Text
            className={`font-bold ${report.lowest_balance < 0 ? 'text-danger' : 'text-foreground'}`}
          >
            {formatCompactCurrency(report.lowest_balance, report.currency)}
          </Text>
          <Text className="text-muted-foreground text-xs">{report.lowest_date}</Text>
        </View>
        <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
          <Text className="text-muted-foreground text-xs mb-1">
            {t('netProjected') || 'Net Projected'}
          </Text>
          <Text
            className={`font-bold ${report.summary.net_projected >= 0 ? 'text-success' : 'text-danger'}`}
          >
            {report.summary.net_projected >= 0 ? '+' : ''}
            {formatCompactCurrency(report.summary.net_projected, report.currency)}
          </Text>
        </View>
      </View>

      {/* Recurring/Subscription breakdown */}
      {(report.summary.recurring_income > 0 ||
        report.summary.recurring_expense > 0 ||
        report.summary.subscription_cost > 0) && (
        <View className="bg-secondary/30 p-3 rounded-lg mb-4">
          <Text className="text-muted-foreground text-xs font-medium mb-2">
            {t('recurringBreakdown') || 'Recurring Breakdown'}
          </Text>
          {report.summary.recurring_income > 0 && (
            <View className="flex-row justify-between mb-1">
              <Text className="text-foreground text-sm">
                {t('recurringIncome') || 'Recurring Income'}
              </Text>
              <Text className="text-success text-sm font-medium">
                +{formatCompactCurrency(report.summary.recurring_income, report.currency)}
              </Text>
            </View>
          )}
          {report.summary.recurring_expense > 0 && (
            <View className="flex-row justify-between mb-1">
              <Text className="text-foreground text-sm">
                {t('recurringExpense') || 'Recurring Expenses'}
              </Text>
              <Text className="text-danger text-sm font-medium">
                -{formatCompactCurrency(report.summary.recurring_expense, report.currency)}
              </Text>
            </View>
          )}
          {report.summary.subscription_cost > 0 && (
            <View className="flex-row justify-between">
              <Text className="text-foreground text-sm">
                {t('subscriptionCost') || 'Subscriptions'}
              </Text>
              <Text className="text-danger text-sm font-medium">
                -{formatCompactCurrency(report.summary.subscription_cost, report.currency)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <View>
          <Text className="text-muted-foreground text-xs font-medium mb-2">
            {t('upcomingCharges') || 'Upcoming Charges'}
          </Text>
          {upcomingEvents.map((event, idx) => (
            <View key={idx} className="flex-row items-center justify-between py-2 border-b border-border/50">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-6 h-6 rounded items-center justify-center mr-2"
                  style={{
                    backgroundColor:
                      event.type === 'subscription'
                        ? colors.accent + '20'
                        : colors.success + '20',
                  }}
                >
                  {event.type === 'subscription' ? (
                    <Calendar size={12} color={colors.accent} />
                  ) : (
                    <ArrowDown size={12} color={colors.success} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-sm" numberOfLines={1}>
                    {event.description}
                  </Text>
                  <Text className="text-muted-foreground text-xs">{event.date}</Text>
                </View>
              </View>
              <Text
                className={`text-sm font-medium ${event.type === 'recurring' ? 'text-foreground' : 'text-danger'}`}
              >
                {event.type === 'subscription' ? '-' : ''}
                {formatCompactCurrency(event.amount, report.currency)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
