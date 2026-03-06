import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, AlertTriangle, Calendar, ArrowDown, ArrowUp } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency } from '../../../utils/format';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';

export function CashFlowProjectionCard() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { reportTimeZone } = useReportTimeZone();

  const { data: report, isPending } = useQuery({
    queryKey: ['reports', 'cashflow', reportTimeZone],
    queryFn: () => api.reports.cashflow(30, undefined, reportTimeZone),
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
  const hasUpcomingCredits = upcomingEvents.some((event) => event.direction === 'credit');
  const hasUpcomingDebits = upcomingEvents.some(
    (event) => event.direction === 'debit' || event.type === 'subscription'
  );
  const upcomingEventsLabel = hasUpcomingCredits && hasUpcomingDebits
    ? t('upcomingEvents') || 'Upcoming Events'
    : hasUpcomingCredits
      ? t('upcomingIncome') || 'Upcoming Income'
      : t('upcomingCharges') || 'Upcoming Charges';

  return (
    <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ backgroundColor: colors.accent + '33', padding: 8, borderRadius: 8, marginRight: 12 }}>
          <TrendingUp size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            {t('cashFlowProjection') || 'Cash Flow Projection'}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {report.days_projected} {t('daysProjected') || 'days projected'}
          </Text>
        </View>
      </View>

      {/* Balance Chart */}
      <View style={{ height: chartHeight, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%', gap: 2 }}>
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
              <View key={index} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <View
                  style={{
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {projections[0]?.date.slice(5) || ''}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {projections[projections.length - 1]?.date.slice(5) || ''}
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.success, marginRight: 4 }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('healthy') || 'Healthy'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 9999, marginRight: 4, backgroundColor: colors.warning }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('low') || 'Low'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.danger, marginRight: 4 }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('negative') || 'Negative'}</Text>
        </View>
      </View>

      {/* Danger Zone Alert */}
      {report.danger_zone && report.danger_date && (
        <View style={{ backgroundColor: colors.danger + '1a', borderWidth: 1, borderColor: colors.danger + '4d', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <AlertTriangle size={20} color={colors.danger} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
              {t('dangerZone') || 'Danger Zone'}
            </Text>
            <Text style={{ color: colors.danger + 'cc', fontSize: 12, marginTop: 2 }}>
              {t('balanceGoesNegative') || 'Balance projected to go negative on'}{' '}
              {report.danger_date}
            </Text>
          </View>
        </View>
      )}

      {/* Summary Stats */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>
            {t('expectedIncome') || 'Expected Income'}
          </Text>
          <Text style={{ color: colors.success, fontFamily: 'Inter_700Bold' }}>
            {formatCompactCurrency(report.summary.expected_income, report.currency)}
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>
            {t('expectedExpenses') || 'Expected Expenses'}
          </Text>
          <Text style={{ color: colors.danger, fontFamily: 'Inter_700Bold' }}>
            {formatCompactCurrency(report.summary.expected_expenses, report.currency)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>
            {t('lowestBalance') || 'Lowest Balance'}
          </Text>
          <Text
            style={{ fontFamily: 'Inter_700Bold', color: report.lowest_balance < 0 ? colors.danger : colors.foreground }}
          >
            {formatCompactCurrency(report.lowest_balance, report.currency)}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{report.lowest_date}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>
            {t('netProjected') || 'Net Projected'}
          </Text>
          <Text
            style={{ fontFamily: 'Inter_700Bold', color: report.summary.net_projected >= 0 ? colors.success : colors.danger }}
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
        <View style={{ backgroundColor: colors.secondary + '4d', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8 }}>
            {t('recurringBreakdown') || 'Recurring Breakdown'}
          </Text>
          {report.summary.recurring_income > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 14 }}>
                {t('recurringIncome') || 'Recurring Income'}
              </Text>
              <Text style={{ color: colors.success, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
                +{formatCompactCurrency(report.summary.recurring_income, report.currency)}
              </Text>
            </View>
          )}
          {report.summary.recurring_expense > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 14 }}>
                {t('recurringExpense') || 'Recurring Expenses'}
              </Text>
              <Text style={{ color: colors.danger, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
                -{formatCompactCurrency(report.summary.recurring_expense, report.currency)}
              </Text>
            </View>
          )}
          {report.summary.subscription_cost > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.foreground, fontSize: 14 }}>
                {t('subscriptionCost') || 'Subscriptions'}
              </Text>
              <Text style={{ color: colors.danger, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
                -{formatCompactCurrency(report.summary.subscription_cost, report.currency)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8 }}>
            {upcomingEventsLabel}
          </Text>
          {upcomingEvents.map((event, idx) => {
            const isExpense = event.direction === 'debit' || event.type === 'subscription';
            const eventTint = event.type === 'subscription'
              ? colors.accent
              : isExpense
                ? colors.danger
                : colors.success;

            return (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '80' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                      backgroundColor: event.type === 'subscription' ? colors.accent + '20' : eventTint + '20',
                    }}
                  >
                    {event.type === 'subscription' ? (
                      <Calendar size={12} color={colors.accent} />
                    ) : !isExpense ? (
                      <ArrowUp size={12} color={eventTint} />
                    ) : (
                      <ArrowDown size={12} color={eventTint} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 14 }} numberOfLines={1}>
                      {event.description}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{event.date}</Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Inter_500Medium',
                    color: isExpense ? colors.danger : colors.success,
                  }}
                >
                  {isExpense ? '-' : '+'}
                  {formatCompactCurrency(event.amount, report.currency)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
