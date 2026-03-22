import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, PieChart, BarChart3, ArrowRight } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { formatCompactCurrency } from '../../../utils/format';
import { CATEGORY_COLORS } from '../../../constants/icons';
import { Card } from '../../ui';

interface DashboardChartsProps {
  currency: string;
}

export function DashboardCharts({ currency }: DashboardChartsProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  // Get current month data
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: monthlyData, isPending } = useQuery({
    queryKey: ['monthly-report', year, month],
    queryFn: () => api.reports.monthly(year, month),
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: categoryData } = useQuery({
    queryKey: ['category-report', year, month],
    queryFn: () => api.reports.category(),
    staleTime: 60 * 1000,
  });

  if (isPending) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
      </View>
    );
  }

  if (!monthlyData) {
    return null;
  }

  const income = monthlyData.income || 0;
  const expenses = monthlyData.expenses || 0;
  const net = income - expenses;
  const netIsPositive = net >= 0;

  // Top 5 expense categories
  const topCategories = (categoryData?.categories || [])
    .filter((c: any) => c.amount > 0)
    .sort((a: any, b: any) => b.amount - a.amount)
    .slice(0, 5);

  const maxExpense = topCategories[0]?.amount || 0;

  return (
    <View style={{ gap: 16 }}>
      {/* Income vs Expenses Card */}
      <Card style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: theme.typography.h3.fontFamily,
              color: theme.colors.foreground,
            }}
          >
            {t('thisMonth') || 'This Month'}
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/reports')}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <ArrowRight size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Income/Expense Bars */}
        <View style={{ gap: 12, marginBottom: 16 }}>
          {/* Income Bar */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14} color={theme.colors.success} />
                <Text style={{ color: theme.colors.foreground, fontSize: 13 }}>{t('income') || 'Income'}</Text>
              </View>
              <Text
                style={{
                  color: theme.colors.success,
                  fontSize: 14,
                  fontFamily: theme.typography.bodyMedium.fontFamily,
                }}
              >
                {formatCompactCurrency(income, currency)}
              </Text>
            </View>
            <View
              style={{
                height: 8,
                backgroundColor: theme.colors.secondary,
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  backgroundColor: theme.colors.success,
                  width: maxExpense > 0 ? `${Math.min((income / Math.max(income, expenses)) * 100, 100)}%` : '0%',
                  borderRadius: 4,
                }}
              />
            </View>
          </View>

          {/* Expenses Bar */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TrendingDown size={14} color={theme.colors.danger} />
                <Text style={{ color: theme.colors.foreground, fontSize: 13 }}>{t('expenses') || 'Expenses'}</Text>
              </View>
              <Text
                style={{
                  color: theme.colors.danger,
                  fontSize: 14,
                  fontFamily: theme.typography.bodyMedium.fontFamily,
                }}
              >
                {formatCompactCurrency(expenses, currency)}
              </Text>
            </View>
            <View
              style={{
                height: 8,
                backgroundColor: theme.colors.secondary,
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  backgroundColor: theme.colors.danger,
                  width: maxExpense > 0 ? `${Math.min((expenses / Math.max(income, expenses)) * 100, 100)}%` : '0%',
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        </View>

        {/* Net Cash Flow */}
        <View
          style={{
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: theme.colors.mutedForeground,
            }}
          >
            {t('netCashFlow') || 'Net Cash Flow'}
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontFamily: theme.typography.h3.fontFamily,
              color: netIsPositive ? theme.colors.success : theme.colors.danger,
            }}
          >
            {netIsPositive ? '+' : ''}
            {formatCompactCurrency(net, currency)}
          </Text>
        </View>
      </Card>

      {/* Top Spending Categories */}
      {topCategories.length > 0 && (
        <Card style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PieChart size={18} color={theme.colors.foreground} />
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: theme.typography.h3.fontFamily,
                  color: theme.colors.foreground,
                }}
              >
                {t('topCategories') || 'Top Categories'}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(app)/(tabs)/reports')}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <ArrowRight size={18} color={theme.colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={{ gap: 10 }}>
            {topCategories.map((category: any, index: number) => {
              const percentage = maxExpense > 0 ? (category.amount / maxExpense) * 100 : 0;
              const color = CATEGORY_COLORS[category.category?.toLowerCase()] || theme.colors.accent;

              return (
                <View key={index}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.colors.foreground,
                        fontSize: 13,
                        textTransform: 'capitalize',
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {category.category}
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.mutedForeground,
                        fontSize: 13,
                        marginLeft: 8,
                      }}
                    >
                      {formatCompactCurrency(category.amount, currency)}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: theme.colors.secondary,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: color,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* View Full Reports Link */}
      <Pressable
        onPress={() => router.push('/(app)/(tabs)/reports')}
        style={({ pressed }) => [
          {
            padding: 16,
            borderRadius: theme.radii.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <BarChart3 size={18} color={theme.colors.primary} />
        <Text
          style={{
            color: theme.colors.primary,
            fontSize: 14,
            fontFamily: theme.typography.bodyMedium.fontFamily,
          }}
        >
          {t('viewFullReports') || 'View Full Reports'}
        </Text>
      </Pressable>
    </View>
  );
}
