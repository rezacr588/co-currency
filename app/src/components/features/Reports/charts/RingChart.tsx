import { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from 'styled-components/native';
import { formatNumber } from '../../../../utils/format';

export interface RingChartSegment {
  value: number;
  color: string;
  label: string;
}

interface RingChartProps {
  segments: RingChartSegment[];
  centerLabel: string;
  centerValue: string;
  size?: number;
  strokeWidth?: number;
}

function RingChartComponent({
  segments,
  centerLabel,
  centerValue,
  size = 160,
  strokeWidth = 20,
}: RingChartProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate cumulative offsets for each segment (memoized)
  const arcs = useMemo(() => {
    let cumulativePercent = 0;
    return segments.map((segment) => {
      const percent = segment.value / total;
      const dashArray = percent * circumference;
      const dashOffset = -cumulativePercent * circumference;
      cumulativePercent += percent;
      return { ...segment, dashArray, dashOffset, percent };
    });
  }, [segments, total, circumference]);

  if (total === 0) return null;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          {/* Background ring */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.secondary}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Colored segments */}
          {arcs.map((arc, index) => (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${arc.dashArray} ${circumference - arc.dashArray}`}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="butt"
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          ))}
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{centerLabel}</Text>
          <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: 'Inter_700Bold' }}>{centerValue}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
        {segments.slice(0, 4).map((segment, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: segment.color, marginEnd: theme.spacing.xs }}
            />
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {segment.label} ({formatNumber((segment.value / total) * 100, 0)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export const RingChart = memo(RingChartComponent);
