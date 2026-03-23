import { memo } from 'react';
import { View, Text } from 'react-native';
import { TrendingUp } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency } from '../../../../utils/format';

interface ComparisonBarChartProps {
  income: number;
  expenses: number;
  currency: string;
  t: (key: string) => string;
}

function ComparisonBarChartComponent({
  income,
  expenses,
  currency,
  t,
}: ComparisonBarChartProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const maxValue = Math.max(income, expenses);
  const incomePercent = maxValue > 0 ? (income / maxValue) * 100 : 0;
  const expensePercent = maxValue > 0 ? (expenses / maxValue) * 100 : 0;

  return (
    <View style={{ gap: 16 }}>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TrendingUp size={14} color={colors.success} />
            <Text style={{ color: colors.foreground, fontSize: 14, marginStart: 4 }}>{t('income')}</Text>
          </View>
          <Text style={{ color: colors.success, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
            {formatCompactCurrency(income, currency)}
          </Text>
        </View>
        <View style={{ height: 16, backgroundColor: colors.secondary, borderRadius: 9999, overflow: 'hidden' }}>
          <View
            style={{ height: '100%', borderRadius: 9999, backgroundColor: colors.success, width: `${incomePercent}%` }}
          />
        </View>
      </View>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TrendingUp size={14} color={colors.danger} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={{ color: colors.foreground, fontSize: 14, marginStart: 4 }}>{t('expenses')}</Text>
          </View>
          <Text style={{ color: colors.danger, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
            {formatCompactCurrency(expenses, currency)}
          </Text>
        </View>
        <View style={{ height: 16, backgroundColor: colors.secondary, borderRadius: 9999, overflow: 'hidden' }}>
          <View
            style={{ height: '100%', borderRadius: 9999, backgroundColor: colors.danger, width: `${expensePercent}%` }}
          />
        </View>
      </View>
    </View>
  );
}

export const ComparisonBarChart = memo(ComparisonBarChartComponent);
