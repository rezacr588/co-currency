import { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from 'styled-components/native';
import { CATEGORY_COLORS } from '../../../../constants/icons';

interface HorizontalBarChartProps {
  data: any[];
  maxValue: number;
  labelKey: string;
  valueKey: string;
  formatValue?: (value: number) => string;
  onPressItem?: (item: any) => void;
  getItemAccessibilityLabel?: (item: any) => string;
}

function HorizontalBarChartComponent({
  data,
  maxValue,
  labelKey,
  valueKey,
  formatValue,
  onPressItem,
  getItemAccessibilityLabel,
}: HorizontalBarChartProps) {
  const theme = useTheme();
  const colors = theme.colors;
  
  return (
    <View style={{ gap: 12 }}>
      {data.map((item, index) => {
        const value = item[valueKey];
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const color = CATEGORY_COLORS[item[labelKey]?.toLowerCase()] || colors.accent;

        const content = (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, textTransform: 'capitalize' }}>{item[labelKey]}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                {formatValue ? formatValue(value) : value}
              </Text>
            </View>
            <View style={{ height: 12, backgroundColor: colors.secondary, borderRadius: 9999, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  borderRadius: 9999,
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: color,
                }}
              />
            </View>
          </>
        );

        if (!onPressItem) {
          return <View key={index}>{content}</View>;
        }

        return (
          <Pressable
            key={index}
            onPress={() => onPressItem(item)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.82 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={getItemAccessibilityLabel?.(item)}
            accessibilityHint="View category details"
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}

export const HorizontalBarChart = memo(HorizontalBarChartComponent);
