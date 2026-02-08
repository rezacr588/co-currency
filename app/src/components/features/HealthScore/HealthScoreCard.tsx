import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Heart, TrendingUp, TrendingDown, Minus, RefreshCw, Info } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useColors } from '../../../context/ThemeContext';
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
  const colors = useColors();
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
    <View className="items-center">
      {/* Score Circle - Simple solid ring design */}
      <View
        className="w-24 h-24 rounded-full items-center justify-center"
        style={{
          borderWidth: 8,
          borderColor: `${color}30`,
          backgroundColor: 'transparent',
        }}
      >
        {/* Progress indicator - colored arc segment */}
        <View
          className="absolute w-24 h-24 rounded-full"
          style={{
            borderWidth: 8,
            borderColor: 'transparent',
            borderLeftColor: score > 0 ? color : 'transparent',
            borderBottomColor: score > 25 ? color : 'transparent',
            borderRightColor: score > 50 ? color : 'transparent',
            borderTopColor: score > 75 ? color : 'transparent',
          }}
        />
        {/* Score text */}
        <View className="items-center justify-center">
          <Text className="text-3xl font-bold text-foreground">{score}</Text>
          <Text className="text-xs text-muted-foreground">/100</Text>
        </View>
      </View>
    </View>
  );
}

function ComponentBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="mb-2">
      <View className="flex-row justify-between mb-1">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Text className="text-xs text-foreground font-medium">{Math.round(value)}%</Text>
      </View>
      <View className="h-1.5 bg-muted rounded-full overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{
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
  const colors = useColors();

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
      <View className="bg-card border border-border p-4 rounded-xl">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-success/20 items-center justify-center mr-3">
              <Heart size={20} color={colors.success} />
            </View>
            <View>
              <Text className="text-foreground font-semibold">
                {t('financialHealth') || 'Financial Health'}
              </Text>
              {isPending ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : healthScore ? (
                <View className="flex-row items-center">
                  <Text className="text-2xl font-bold text-foreground mr-2">
                    {healthScore.score}
                  </Text>
                  {getTrendIcon(healthScore.trend)}
                </View>
              ) : (
                <Text className="text-muted-foreground text-sm">
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
    <View className="bg-card border border-border p-5 rounded-xl">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-success/20 items-center justify-center mr-3">
            <Heart size={20} color={colors.success} />
          </View>
          <View>
            <Text className="text-base font-semibold text-foreground">
              {t('financialHealth') || 'Financial Health Score'}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {t('overallFinancialWellness') || 'Your overall financial wellness'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleRefresh}
          disabled={isRefetching}
          style={{ cursor: 'pointer' }}
          className="p-2"
        >
          <RefreshCw
            size={18}
            color={colors.mutedForeground}
            style={isRefetching ? { opacity: 0.5 } : undefined}
          />
        </Pressable>
      </View>

      {isPending || isRefetching ? (
        <View className="items-center py-8">
          <ActivityIndicator color={colors.accent} />
          <Text className="text-muted-foreground text-sm mt-2">
            {t('calculatingScore') || 'Calculating your score...'}
          </Text>
        </View>
      ) : healthScore ? (
        <>
          {/* Score Display */}
          <View className="flex-row items-center justify-between mb-6">
            <ScoreGauge score={healthScore.score} />
            <View className="flex-1 ml-6">
              <Text className="text-lg font-bold text-foreground mb-1">
                {getScoreLabel(healthScore.score)}
              </Text>
              <View className="flex-row items-center">
                {getTrendIcon(healthScore.trend)}
                <Text className="text-sm text-muted-foreground ml-1">
                  {getTrendLabel(healthScore.trend)}
                </Text>
              </View>
            </View>
          </View>

          {/* Component Breakdown */}
          <View className="bg-muted/50 p-4 rounded-lg mb-4">
            <Text className="text-sm font-medium text-foreground mb-3">
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
              <View className="flex-row items-center mb-2">
                <Info size={14} color={colors.mutedForeground} />
                <Text className="text-xs text-muted-foreground ml-1 font-medium">
                  {t('tipsToImprove') || 'Tips to improve'}
                </Text>
              </View>
              {healthScore.tips.slice(0, 2).map((tip, idx) => (
                <View key={idx} className="flex-row items-start mb-1">
                  <Text className="text-accent mr-2">•</Text>
                  <Text className="text-foreground text-sm flex-1">{tip}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <View className="bg-muted/50 p-6 rounded-lg items-center">
          <Heart size={32} color={colors.mutedForeground} />
          <Text className="text-muted-foreground text-center mt-2">
            {t('addTransactionsForScore') || 'Add some transactions to calculate your financial health score'}
          </Text>
        </View>
      )}
    </View>
  );
}
