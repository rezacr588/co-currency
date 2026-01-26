import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, PieChart, BarChart3 } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency, formatNumber } from '../../../src/utils/format';

export default function ReportsScreen() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  const { data: monthlyReport, isPending: isLoadingMonthly } = useQuery({
    queryKey: ['reports', 'monthly'],
    queryFn: () => api.reports.monthly(),
  });

  const { data: categoryReport, isPending: isLoadingCategory } = useQuery({
    queryKey: ['reports', 'category'],
    queryFn: () => api.reports.category(),
  });

  const { data: networth, isPending: isLoadingNetworth } = useQuery({
    queryKey: ['reports', 'networth'],
    queryFn: () => api.reports.networth(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['reports'] });
    setRefreshing(false);
  };

  const isPending = isLoadingMonthly || isLoadingCategory || isLoadingNetworth;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 24,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text className="text-3xl font-bold text-foreground mb-6">{t('reportsAndStats')}</Text>

        {isPending ? (
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
        ) : (
          <>
            {/* Net Worth Card */}
            {networth && (
              <View className="bg-card p-6 rounded-xl mb-6" style={{ maxWidth: isDesktop ? 600 : '100%' }}>
                <View className="flex-row items-center mb-2">
                  <PieChart size={20} color="rgb(212, 175, 55)" />
                  <Text className="text-muted-foreground ml-2">{t('netWorth')}</Text>
                </View>
                <Text className="text-4xl font-bold text-accent">
                  {formatCompactCurrency(networth.total_balance, networth.currency)}
                </Text>
              </View>
            )}

            {/* Monthly Summary */}
            {monthlyReport && (
              <View className="mb-6">
                <Text className="text-lg font-semibold text-foreground mb-4">
                  {t('monthlySummary')}
                </Text>
                <View style={{
                  flexDirection: isTablet ? 'row' : 'column',
                  gap: 16,
                }}>
                  <View style={{ flex: 1 }} className="bg-success/10 p-4 rounded-xl">
                    <View className="flex-row items-center mb-2">
                      <TrendingUp size={16} color="rgb(16, 185, 129)" />
                      <Text className="text-success ml-2 text-sm">{t('income')}</Text>
                    </View>
                    <Text className="text-xl font-bold text-foreground">
                      {formatCompactCurrency(monthlyReport.income, monthlyReport.currency)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }} className="bg-danger/10 p-4 rounded-xl">
                    <View className="flex-row items-center mb-2">
                      <TrendingDown size={16} color="rgb(220, 38, 38)" />
                      <Text className="text-danger ml-2 text-sm">{t('expenses')}</Text>
                    </View>
                    <Text className="text-xl font-bold text-foreground">
                      {formatCompactCurrency(monthlyReport.expenses, monthlyReport.currency)}
                    </Text>
                  </View>
                </View>

                {/* Net & Savings Rate */}
                <View style={{
                  flexDirection: isTablet ? 'row' : 'column',
                  gap: 16,
                  marginTop: 16,
                }}>
                  <View style={{ flex: 1 }} className="bg-card p-4 rounded-xl">
                    <Text className="text-muted-foreground text-sm mb-1">{t('net')}</Text>
                    <Text
                      className={`text-xl font-bold ${
                        monthlyReport.net >= 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {monthlyReport.net >= 0 ? '+' : ''}
                      {formatCompactCurrency(monthlyReport.net, monthlyReport.currency)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }} className="bg-card p-4 rounded-xl">
                    <Text className="text-muted-foreground text-sm mb-1">{t('savingsRate')}</Text>
                    <Text
                      className={`text-xl font-bold ${
                        monthlyReport.savings_rate >= 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {formatNumber(monthlyReport.savings_rate, 1)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Category Breakdown */}
            {categoryReport && categoryReport.categories.length > 0 && (
              <View>
                <View className="flex-row items-center mb-4">
                  <BarChart3 size={20} color="rgb(148, 163, 184)" />
                  <Text className="text-lg font-semibold text-foreground ml-2">
                    {t('categoryBreakdown')}
                  </Text>
                </View>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  {categoryReport.categories.slice(0, 5).map((cat) => (
                    <View
                      key={cat.category}
                      className="bg-card p-4 rounded-xl"
                      style={{
                        width: isDesktop ? '48%' : '100%',
                        minWidth: isDesktop ? 300 : undefined,
                      } as any}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="font-semibold text-foreground capitalize">
                          {cat.category}
                        </Text>
                        <Text className="text-foreground">
                          {formatCompactCurrency(cat.amount, categoryReport.currency)}
                        </Text>
                      </View>
                      <View className="h-2 bg-secondary rounded-full">
                        <View
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </View>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-muted-foreground text-sm">
                          {cat.count} {t('transactions')}
                        </Text>
                        <Text className="text-muted-foreground text-sm">
                          {formatNumber(cat.percentage, 1)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
