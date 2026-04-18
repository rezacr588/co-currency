import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, AlertTriangle, Calendar, ArrowDown, ArrowUp } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency } from '../../../utils/format';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';
import { REPORT_QUERY_RETRY, REPORT_QUERY_STALE_TIME_MS } from './queryConfig';
import type { CashFlowEvent, CashFlowReport } from '../../../types/goal';
import {
  formatRelativeReportDateLabel,
  formatReportDateKey,
} from './reportUX';

type UpcomingCashFlowEvent = CashFlowEvent & { date: string };

interface EventGroup {
  date: string;
  relativeLabel: string;
  absoluteLabel: string;
  events: UpcomingCashFlowEvent[];
  dayNet: number;
}

function getEventDirection(event: CashFlowEvent): 'credit' | 'debit' {
  if (event.direction) {
    return event.direction;
  }

  return event.type === 'subscription' ? 'debit' : 'credit';
}

function getEventBadgeLabel(event: CashFlowEvent, t: (key: string) => string): string {
  if (event.type === 'subscription') {
    return t('subscriptionLabel') || 'Subscription';
  }

  return getEventDirection(event) === 'credit'
    ? (t('recurringIncome') || 'Recurring Income')
    : (t('recurringExpense') || 'Recurring Expenses');
}

function groupEventsByDate(
  events: UpcomingCashFlowEvent[],
  language: string,
  reportTimeZone: string,
  t: (key: string) => string
): EventGroup[] {
  const groups = new Map<string, UpcomingCashFlowEvent[]>();

  for (const event of events) {
    const existing = groups.get(event.date) || [];
    existing.push(event);
    groups.set(event.date, existing);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, groupedEvents]) => ({
      date,
      relativeLabel: formatRelativeReportDateLabel(date, language, reportTimeZone, t),
      absoluteLabel: formatReportDateKey(date, language, reportTimeZone, {
        month: 'short',
        day: 'numeric',
      }),
      events: groupedEvents,
      dayNet: groupedEvents.reduce((sum, event) => {
        return sum + (getEventDirection(event) === 'credit' ? event.amount : -event.amount);
      }, 0),
    }));
}

interface CashFlowProjectionCardProps {
  report?: CashFlowReport | null;
}

export function CashFlowProjectionCard({ report: providedReport = null }: CashFlowProjectionCardProps) {
  const { t, language } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { reportTimeZone } = useReportTimeZone();

  const { data: queriedReport, isPending: isQueryPending } = useQuery({
    queryKey: ['reports', 'cashflow', reportTimeZone],
    queryFn: () => api.reports.cashflow(30, undefined, reportTimeZone),
    enabled: providedReport == null,
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  const report = providedReport ?? queriedReport;
  const isPending = providedReport == null && isQueryPending;

  const projections = report?.projections || [];

  const chartData = useMemo(() => {
    if (!report || projections.length === 0) {
      return null;
    }

    const allBalances = [report.current_balance, ...projections.map((p) => p.balance)];
    const maxBalance = Math.max(...allBalances);
    const minBalance = Math.min(...allBalances);
    const range = maxBalance - minBalance || 1;
    const chartHeight = 120;
    const step = Math.max(1, Math.floor(projections.length / 15));
    const sampledPoints = projections.filter((_, index) => index % step === 0 || index === projections.length - 1);

    return {
      chartHeight,
      range,
      minBalance,
      sampledPoints,
    };
  }, [projections, report]);

  const upcomingEvents = useMemo(() => {
    return projections
      .slice(0, 7)
      .flatMap((projection) =>
        (projection.events || []).map((event) => ({
          ...event,
          date: projection.date,
        }))
      );
  }, [projections]);

  const creditEvents = useMemo(
    () => upcomingEvents.filter((event) => getEventDirection(event) === 'credit'),
    [upcomingEvents]
  );
  const debitEvents = useMemo(
    () => upcomingEvents.filter((event) => getEventDirection(event) === 'debit'),
    [upcomingEvents]
  );
  const groupedCreditEvents = useMemo(
    () => groupEventsByDate(creditEvents, language, reportTimeZone, t),
    [creditEvents, language, reportTimeZone, t]
  );
  const groupedDebitEvents = useMemo(
    () => groupEventsByDate(debitEvents, language, reportTimeZone, t),
    [debitEvents, language, reportTimeZone, t]
  );
  const hasMixedDirections = groupedCreditEvents.length > 0 && groupedDebitEvents.length > 0;
  const lowestBalanceLabel = report
    ? formatRelativeReportDateLabel(report.lowest_date, language, reportTimeZone, t)
    : '';
  const dangerDateLabel = report?.danger_date
    ? formatRelativeReportDateLabel(report.danger_date, language, reportTimeZone, t)
    : null;

  if (isPending || !report || projections.length === 0 || !chartData) {
    return null;
  }

  return (
    <View style={{ backgroundColor: colors.card, padding: theme.spacing.xxl, borderRadius: theme.radii.md, marginBottom: theme.spacing.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
        <View style={{ backgroundColor: theme.alpha(colors.accent, 0.2), padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
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

      <View style={{ height: chartData.chartHeight, marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%', gap: 2 }}>
          {chartData.sampledPoints.map((point, index) => {
            const normalizedHeight =
              chartData.range > 0
                ? ((point.balance - chartData.minBalance) / chartData.range) * (chartData.chartHeight - 20) + 10
                : chartData.chartHeight / 2;

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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xs }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {formatReportDateKey(projections[0]?.date || report.lowest_date, language, reportTimeZone)}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {formatReportDateKey(projections[projections.length - 1]?.date || report.lowest_date, language, reportTimeZone)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.lg, marginBottom: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: theme.radii.full, backgroundColor: colors.success, marginEnd: theme.spacing.xs }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('healthy') || 'Healthy'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: theme.radii.full, marginEnd: theme.spacing.xs, backgroundColor: colors.warning }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('low') || 'Low'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: theme.radii.full, backgroundColor: colors.danger, marginEnd: theme.spacing.xs }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('negative') || 'Negative'}</Text>
        </View>
      </View>

      {report.danger_zone && report.danger_date && (
        <View style={{ backgroundColor: theme.alpha(colors.danger, 0.1), borderWidth: 1, borderColor: theme.alpha(colors.danger, 0.3), padding: theme.spacing.lg, borderRadius: theme.radii.md, flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <AlertTriangle size={20} color={colors.danger} />
          <View style={{ marginStart: theme.spacing.md, flex: 1 }}>
            <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
              {t('dangerZone') || 'Danger Zone'}
            </Text>
            <Text style={{ color: theme.alpha(colors.danger, 0.8), fontSize: 12, marginTop: 2 }}>
              {`${t('closestRiskDay') || 'Closest risk day'}: ${dangerDateLabel} (${formatReportDateKey(report.danger_date, language, reportTimeZone)})`}
            </Text>
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
        <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.md, borderRadius: theme.radii.sm }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>
            {t('expectedIncome') || 'Expected Income'}
          </Text>
          <Text style={{ color: colors.success, fontFamily: 'Inter_700Bold' }}>
            {formatCompactCurrency(report.summary.expected_income, report.currency)}
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.md, borderRadius: theme.radii.sm }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>
            {t('expectedExpenses') || 'Expected Expenses'}
          </Text>
          <Text style={{ color: colors.danger, fontFamily: 'Inter_700Bold' }}>
            {formatCompactCurrency(report.summary.expected_expenses, report.currency)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
        <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.md, borderRadius: theme.radii.sm }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>
            {t('lowestBalance') || 'Lowest Balance'}
          </Text>
          <Text
            style={{ fontFamily: 'Inter_700Bold', color: report.lowest_balance < 0 ? colors.danger : colors.foreground }}
          >
            {formatCompactCurrency(report.lowest_balance, report.currency)}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {`${lowestBalanceLabel} (${formatReportDateKey(report.lowest_date, language, reportTimeZone)})`}
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.md, borderRadius: theme.radii.sm }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>
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

      {(report.summary.recurring_income > 0 ||
        report.summary.recurring_expense > 0 ||
        report.summary.subscription_cost > 0) && (
        <View style={{ backgroundColor: theme.alpha(colors.secondary, 0.3), padding: theme.spacing.md, borderRadius: theme.radii.sm, marginBottom: theme.spacing.lg }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: theme.spacing.sm }}>
            {t('recurringBreakdown') || 'Recurring Breakdown'}
          </Text>
          {report.summary.recurring_income > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
              <Text style={{ color: colors.foreground, fontSize: 14 }}>
                {t('recurringIncome') || 'Recurring Income'}
              </Text>
              <Text style={{ color: colors.success, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
                +{formatCompactCurrency(report.summary.recurring_income, report.currency)}
              </Text>
            </View>
          )}
          {report.summary.recurring_expense > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
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

      {upcomingEvents.length > 0 && (
        <View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: theme.spacing.sm + 2 }}>
            {hasMixedDirections
              ? (t('upcomingEvents') || 'Upcoming Events')
              : groupedCreditEvents.length > 0
                ? (t('upcomingIncome') || 'Upcoming Income')
                : (t('upcomingCharges') || 'Upcoming Charges')}
          </Text>

          {[
            {
              key: 'credits',
              visible: groupedCreditEvents.length > 0,
              title: hasMixedDirections ? (t('incomingSection') || 'Incoming') : null,
              groups: groupedCreditEvents,
              tone: colors.success,
            },
            {
              key: 'debits',
              visible: groupedDebitEvents.length > 0,
              title: hasMixedDirections ? (t('outgoingSection') || 'Outgoing') : null,
              groups: groupedDebitEvents,
              tone: colors.danger,
            },
          ]
            .filter((section) => section.visible)
            .map((section) => (
              <View key={section.key} style={{ marginBottom: section.key === 'debits' ? 0 : theme.spacing.lg }}>
                {section.title ? (
                  <Text style={{ color: section.tone, fontFamily: 'Inter_600SemiBold', marginBottom: theme.spacing.sm + 2 }}>
                    {section.title}
                  </Text>
                ) : null}

                {section.groups.map((group) => (
                  <View
                    key={`${section.key}-${group.date}`}
                    style={{
                      backgroundColor: theme.alpha(colors.secondary, 0.25),
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: theme.radii.md,
                      padding: theme.spacing.md,
                      marginBottom: theme.spacing.sm + 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm + 2 }}>
                      <View>
                        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                          {group.relativeLabel}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                          {group.absoluteLabel}
                        </Text>
                      </View>
                      {group.events.length > 1 ? (
                        <Text
                          style={{
                            color: group.dayNet >= 0 ? colors.success : colors.danger,
                            fontSize: 12,
                            fontFamily: 'Inter_600SemiBold',
                          }}
                        >
                          {(t('dayNetImpact') || 'Day net') + ': '}
                          {group.dayNet >= 0 ? '+' : ''}
                          {formatCompactCurrency(group.dayNet, report.currency)}
                        </Text>
                      ) : null}
                    </View>

                    {group.events.map((event, index) => {
                      const isExpense = getEventDirection(event) === 'debit';
                      const eventTint = event.type === 'subscription'
                        ? colors.accent
                        : isExpense
                          ? colors.danger
                          : colors.success;

                      return (
                        <View
                          key={`${group.date}-${event.description}-${index}`}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingVertical: theme.spacing.sm,
                            borderBottomWidth: index === group.events.length - 1 ? 0 : 1,
                            borderBottomColor: theme.alpha(colors.border, 0.5),
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingEnd: theme.spacing.md }}>
                            <View
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginEnd: theme.spacing.sm + 2,
                                backgroundColor: event.type === 'subscription' ? theme.alpha(colors.accent, 0.125) : theme.alpha(eventTint, 0.125),
                              }}
                            >
                              {event.type === 'subscription' ? (
                                <Calendar size={12} color={colors.accent} />
                              ) : isExpense ? (
                                <ArrowDown size={12} color={eventTint} />
                              ) : (
                                <ArrowUp size={12} color={eventTint} />
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.foreground, fontSize: 14 }} numberOfLines={1}>
                                {event.description}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.xs }}>
                                <View
                                  style={{
                                    backgroundColor: theme.alpha(eventTint, 0.08),
                                    borderRadius: theme.radii.full,
                                    paddingHorizontal: theme.spacing.sm,
                                    paddingVertical: 3,
                                  }}
                                >
                                  <Text style={{ color: eventTint, fontSize: 11, fontFamily: 'Inter_500Medium' }}>
                                    {getEventBadgeLabel(event, t)}
                                  </Text>
                                </View>
                                {event.category ? (
                                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                                    {event.category}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          </View>
                          <Text
                            style={{
                              fontSize: 14,
                              fontFamily: 'Inter_600SemiBold',
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
                ))}
              </View>
            ))}
        </View>
      )}
    </View>
  );
}
