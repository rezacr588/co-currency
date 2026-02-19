import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Heart, TrendingUp, TrendingDown, Minus, RefreshCw, Info } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';

interface HealthScoreData {
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  components: {
    budget_adherence: number;
    savings_rate: number;
    goal_progress: number;
    consistency: number;
    bill_timing: number;
  };
  tips: string[];
}

interface HealthScoreCardProps {
  compact?: boolean;
}

function ScoreGauge({ score }: { score: number }) {
  const theme = useTheme();
  const colors = theme.colors;
  // Calculate color based on score
  const getColor = (score: number): string => {
    if (score >= 80) return colors.success;
    if (score >= 60) return '#84cc16'; // Lime (no direct mapping, keep as is)
    if (score >= 40) return colors.warning;
    if (score >= 20) return '#f97316'; // Orange (no direct mapping, keep as is)
    return colors.danger;
  };

  const color = getColor(score);

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Score Circle - Simple solid ring design */}
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 9999,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 8,
          borderColor: `${color}30`,
          backgroundColor: 'transparent',
        }}
      >
        {/* Progress indicator - colored arc segment */}
        <View
          style={{
            position: 'absolute',
            width: 96,
            height: 96,
            borderRadius: 9999,
            borderWidth: 8,
            borderColor: 'transparent',
            borderLeftColor: score > 0 ? color : 'transparent',
            borderBottomColor: score > 25 ? color : 'transparent',
            borderRightColor: score > 50 ? color : 'transparent',
            borderTopColor: score > 75 ? color : 'transparent',
          }}
        />
        {/* Score text */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 30, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{score}</Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>/100</Text>
        </View>
      </View>
    </View>
  );
}

function ComponentBar({ label, value, color }: { label: string; value: number; color: string }) {
  const theme = useTheme();
  const colors = theme.colors;
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{Math.round(value)}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: colors.muted, borderRadius: 9999, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            borderRadius: 9999,
            width: `${Math.min(100, value)}%`,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

export function HealthScoreCard({ compact = false }: HealthScoreCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;

  const {
    data: healthScore,
    isPending,
    refetch,
    isRefetching,
  } = useQuery<HealthScoreData>({
    queryKey: ['reports', 'health-score'],
    queryFn: () => api.reports.healthScore(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });

  const handleRefresh = () => {
    haptics.light();
    refetch();
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp size={14} color={colors.success} />;
      case 'declining':
        return <TrendingDown size={14} color={colors.danger} />;
      default:
        return <Minus size={14} color={colors.mutedForeground} />;
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'improving':
        return t('improving') || 'Improving';
      case 'declining':
        return t('declining') || 'Declining';
      default:
        return t('stable') || 'Stable';
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return t('excellent') || 'Excellent';
    if (score >= 60) return t('good') || 'Good';
    if (score >= 40) return t('fair') || 'Fair';
    if (score >= 20) return t('needsWork') || 'Needs Work';
    return t('poor') || 'Poor';
  };

  if (compact) {
    return (
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: colors.success + '33', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Heart size={20} color={colors.success} />
            </View>
            <View>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                {t('financialHealth') || 'Financial Health'}
              </Text>
              {isPending ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : healthScore ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginRight: 8 }}>
                    {healthScore.score}
                  </Text>
                  {getTrendIcon(healthScore.trend)}
                </View>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                  {t('noDataYet') || 'No data yet'}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: colors.success + '33', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Heart size={20} color={colors.success} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {t('financialHealth') || 'Financial Health Score'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {t('overallFinancialWellness') || 'Your overall financial wellness'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleRefresh}
          disabled={isRefetching}
          style={{ cursor: 'pointer', padding: 8 }}
        >
          <RefreshCw
            size={18}
            color={colors.mutedForeground}
            style={isRefetching ? { opacity: 0.5 } : undefined}
          />
        </Pressable>
      </View>

      {isPending || isRefetching ? (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
            {t('calculatingScore') || 'Calculating your score...'}
          </Text>
        </View>
      ) : healthScore ? (
        <>
          {/* Score Display */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <ScoreGauge score={healthScore.score} />
            <View style={{ flex: 1, marginLeft: 24 }}>
              <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 4 }}>
                {getScoreLabel(healthScore.score)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {getTrendIcon(healthScore.trend)}
                <Text style={{ fontSize: 14, color: colors.mutedForeground, marginLeft: 4 }}>
                  {getTrendLabel(healthScore.trend)}
                </Text>
              </View>
            </View>
          </View>

          {/* Component Breakdown */}
          <View style={{ backgroundColor: colors.muted + '80', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground, marginBottom: 12 }}>
              {t('scoreBreakdown') || 'Score Breakdown'}
            </Text>
            <ComponentBar
              label={t('budgetAdherence') || 'Budget Adherence'}
              value={healthScore.components.budget_adherence}
              color={colors.info}
            />
            <ComponentBar
              label={t('savingsRate') || 'Savings Rate'}
              value={healthScore.components.savings_rate}
              color={colors.success}
            />
            <ComponentBar
              label={t('goalProgress') || 'Goal Progress'}
              value={healthScore.components.goal_progress}
              color="#8b5cf6"
            />
            <ComponentBar
              label={t('consistency') || 'Tracking Consistency'}
              value={healthScore.components.consistency}
              color={colors.warning}
            />
            <ComponentBar
              label={t('billTiming') || 'Bill Payment Timing'}
              value={healthScore.components.bill_timing}
              color="#06b6d4"
            />
          </View>

          {/* Tips */}
          {healthScore.tips && healthScore.tips.length > 0 && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Info size={14} color={colors.mutedForeground} />
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: 4, fontFamily: 'Inter_500Medium' }}>
                  {t('tipsToImprove') || 'Tips to improve'}
                </Text>
              </View>
              {healthScore.tips.slice(0, 2).map((tip, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                  <Text style={{ color: colors.accent, marginRight: 8 }}>•</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>{tip}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={{ backgroundColor: colors.muted + '80', padding: 24, borderRadius: 8, alignItems: 'center' }}>
          <Heart size={32} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>
            {t('addTransactionsForScore') || 'Add some transactions to calculate your financial health score'}
          </Text>
        </View>
      )}
    </View>
  );
}
