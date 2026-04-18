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
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: theme.spacing.sm, height: 100 }}>
        {data.slice(-6).map((item, index) => {
          const incomeHeight = maxValue > 0 ? (item.income / maxValue) * 80 : 0;
          const expenseHeight = maxValue > 0 ? (item.expenses / maxValue) * 80 : 0;

          return (
            <View key={index} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'flex-end', height: 80 }}>
                <View
                  style={{ width: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.success, height: Math.max(incomeHeight, 2) }}
                  accessibilityLabel={`${item.period} income`}
                />
                <View
                  style={{ width: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.danger, height: Math.max(expenseHeight, 2) }}
                  accessibilityLabel={`${item.period} expenses`}
                />
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: theme.spacing.xs }}>
                {item.period.split('-')[1] || item.period}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.lg, marginTop: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: theme.radii.full, backgroundColor: colors.success, marginEnd: theme.spacing.xs }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('income')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: theme.radii.full, backgroundColor: colors.danger, marginEnd: theme.spacing.xs }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('expenses')}</Text>
        </View>
      </View>
    </View>
  );
}

export const TrendsChart = memo(TrendsChartComponent);
