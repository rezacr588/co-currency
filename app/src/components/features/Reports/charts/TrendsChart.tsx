import { memo } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from 'styled-components/native';

interface TrendsChartProps {
  data: { period: string; income: number; expenses: number; net: number }[];
  t: (key: string) => string;
}

function TrendsChartComponent({ data, t }: TrendsChartProps) {
  const theme = useTheme();
  const colors = theme.colors;

  if (!data || data.length === 0) return null;
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => Math.max(d.income, d.expenses))) : 0;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 100 }}>
        {data.slice(-6).map((item, index) => {
          const incomeHeight = maxValue > 0 ? (item.income / maxValue) * 80 : 0;
          const expenseHeight = maxValue > 0 ? (item.expenses / maxValue) * 80 : 0;

          return (
            <View key={index} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 80 }}>
                <View
                  style={{ width: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.success, height: Math.max(incomeHeight, 2) }}
                  accessibilityLabel={`${item.period} income`}
                />
                <View
                  style={{ width: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.danger, height: Math.max(expenseHeight, 2) }}
                  accessibilityLabel={`${item.period} expenses`}
                />
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                {item.period.split('-')[1] || item.period}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.success, marginEnd: 4 }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('income')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.danger, marginEnd: 4 }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('expenses')}</Text>
        </View>
      </View>
    </View>
  );
}

export const TrendsChart = memo(TrendsChartComponent);
