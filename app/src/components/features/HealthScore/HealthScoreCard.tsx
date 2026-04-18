import { useMemo, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Heart, TrendingUp, TrendingDown, Minus, RefreshCw, Info, ArrowRight } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';
import { Card } from '../../ui';
import { BottomSheet } from '../../ui/BottomSheet';
import { HIT_SLOP_SM, HIT_SLOP_MD } from '../../../constants/hitSlop';

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
  onViewDetails?: () => void;
}

function ScoreGauge({ score }: { score: number }) {
  const theme = useTheme();
  const colors = theme.colors;
  // Palette-coded thresholds for a gradient score scale (high→low).
  const getColor = (score: number): string => {
    if (score >= 80) return colors.palette.green;
    if (score >= 60) return colors.palette.lime;
    if (score >= 40) return colors.warning;
    if (score >= 20) return colors.palette.orange;
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
          borderRadius: theme.radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 8,
          borderColor: theme.alpha(color, 0.19),
          backgroundColor: 'transparent',
        }}
      >
        {/* Progress indicator - colored arc segment */}
        <View
          style={{
            position: 'absolute',
            width: 96,
            height: 96,
            borderRadius: theme.radii.full,
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
          <Text style={{ fontSize: 30, fontFamily: theme.typography.h1.fontFamily, color: colors.foreground }}>{score}</Text>
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
    <View style={{ marginBottom: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily }}>{Math.round(value)}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: colors.muted, borderRadius: theme.radii.full, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            borderRadius: theme.radii.full,
            width: `${Math.min(100, value)}%`,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

export function HealthScoreCard({ compact = false, onViewDetails }: HealthScoreCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { reportTimeZone } = useReportTimeZone();
  const { width } = useWindowDimensions();
  const shouldStackScore = width < 420;
  const methodologySheetRef = useRef<any>(null);

  const {
    data: healthScore,
    isPending,
    refetch,
    isRefetching,
  } = useQuery<HealthScoreData>({
    queryKey: ['reports', 'health-score', reportTimeZone],
    queryFn: () => api.reports.healthScore(undefined, reportTimeZone),
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });

  const handleRefresh = () => {
    haptics.light();
    refetch();
  };

  const handleViewDetails = () => {
    if (!onViewDetails) {
      return;
    }

    haptics.light();
    onViewDetails();
  };

  const handleOpenMethodology = () => {
    haptics.light();
    methodologySheetRef.current?.expand?.();
  };

  const scoreWeights = useMemo(
    () => [
      t('healthScoreWeightSpendingVsIncome'),
      t('healthScoreWeightSavingsRate'),
      t('healthScoreWeightMonthlyCashSurplus'),
      t('healthScoreWeightTrackingConsistency'),
      t('healthScoreWeightCashFlowOutlook'),
    ],
    [t]
  );

  const scoreWindows = useMemo(
    () => [
      t('healthScoreWindowCurrentMonth'),
      t('healthScoreWindowLast30Days'),
      t('healthScoreWindowPreviousMonth'),
    ],
    [t]
  );

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
        return t('improving');
      case 'declining':
        return t('declining');
      default:
        return t('stable');
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return t('excellent');
    if (score >= 60) return t('good');
    if (score >= 40) return t('fair');
    if (score >= 20) return t('needsWork');
    return t('poor');
  };

  if (compact) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: theme.radii.full, backgroundColor: theme.alpha(colors.success, 0.2), alignItems: 'center', justifyContent: 'center', marginEnd: theme.spacing.md }}>
              <Heart size={20} color={colors.success} />
            </View>
            <View>
              <Text style={{ color: colors.foreground, fontFamily: theme.typography.h2.fontFamily }}>
                {t('financialHealth') || 'Financial Health'}
              </Text>
              {isPending ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : healthScore ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontFamily: theme.typography.h1.fontFamily, color: colors.foreground, marginEnd: theme.spacing.sm }}>
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
          {onViewDetails ? (
            <Pressable
              onPress={handleViewDetails}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, paddingStart: theme.spacing.md }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: theme.typography.bodyMedium.fontFamily, marginEnd: theme.spacing.xs }}>
                {t('viewFinancialHealthDetails')}
              </Text>
              <ArrowRight size={14} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </Card>
    );
  }

  return (
    <>
      <Card style={{ padding: theme.spacing.xl }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ width: 40, height: 40, borderRadius: theme.radii.full, backgroundColor: theme.alpha(colors.success, 0.2), alignItems: 'center', justifyContent: 'center', marginEnd: theme.spacing.md, marginTop: 2 }}>
              <Heart size={20} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: theme.typography.h2.fontFamily, color: colors.foreground }}>
                {t('financialHealth') || 'Financial Health Score'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                {t('overallFinancialWellness')}
              </Text>
              <Pressable
                onPress={handleOpenMethodology}
                accessibilityRole="button"
                hitSlop={HIT_SLOP_MD}
                style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginTop: 10 }}
              >
                <Info size={14} color={colors.info} style={{ marginEnd: 6 }} />
                <Text style={{ fontSize: 12, fontFamily: theme.typography.bodyMedium.fontFamily, color: colors.info }}>
                  {t('healthScoreHowItWorksAction')}
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginStart: theme.spacing.md }}>
            <Pressable
              onPress={handleRefresh}
              disabled={isRefetching}
              accessibilityRole="button"
              accessibilityLabel={t('a11yRefresh') || 'Refresh'}
              hitSlop={HIT_SLOP_SM}
              style={{ cursor: 'pointer', padding: theme.spacing.sm }}
            >
              <RefreshCw
                size={18}
                color={colors.mutedForeground}
                style={isRefetching ? { opacity: 0.5 } : undefined}
              />
            </Pressable>
          </View>
        </View>

        <View style={{ backgroundColor: theme.alpha(colors.info, 0.07), borderRadius: 10, padding: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          <Text style={{ fontSize: 13, lineHeight: 18, color: colors.foreground }}>
            {t('healthScoreInlineExplainer')}
          </Text>
        </View>

        {isPending || isRefetching ? (
          <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xxxl }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: theme.spacing.sm }}>
              {t('calculatingScore')}
            </Text>
          </View>
        ) : healthScore ? (
          <>
            {/* Score Display */}
            <View
              style={{
                flexDirection: shouldStackScore ? 'column' : 'row',
                alignItems: shouldStackScore ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                marginBottom: theme.spacing.xxl,
              }}
            >
              <ScoreGauge score={healthScore.score} />
              <View style={{ flex: shouldStackScore ? undefined : 1, marginStart: shouldStackScore ? 0 : theme.spacing.xxl, marginTop: shouldStackScore ? theme.spacing.lg : 0, width: shouldStackScore ? '100%' : undefined }}>
                <Text style={{ fontSize: 18, fontFamily: theme.typography.h1.fontFamily, color: colors.foreground, marginBottom: theme.spacing.xs }}>
                  {getScoreLabel(healthScore.score)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {getTrendIcon(healthScore.trend)}
                  <Text style={{ fontSize: 14, color: colors.mutedForeground, marginStart: theme.spacing.xs }}>
                    {getTrendLabel(healthScore.trend)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Component Breakdown */}
            <View style={{ backgroundColor: theme.alpha(colors.muted, 0.5), padding: theme.spacing.lg, borderRadius: theme.radii.sm, marginBottom: theme.spacing.lg }}>
              <Text style={{ fontSize: 14, fontFamily: theme.typography.bodyMedium.fontFamily, color: colors.foreground, marginBottom: theme.spacing.md }}>
                {t('scoreBreakdown')}
              </Text>
              <ComponentBar
                label={t('budgetAdherence')}
                value={healthScore.components.budget_adherence}
                color={colors.info}
              />
              <ComponentBar
                label={t('savingsRate')}
                value={healthScore.components.savings_rate}
                color={colors.success}
              />
              <ComponentBar
                label={t('goalProgress')}
                value={healthScore.components.goal_progress}
                color={colors.palette.purple}
              />
              <ComponentBar
                label={t('consistency')}
                value={healthScore.components.consistency}
                color={colors.warning}
              />
              <ComponentBar
                label={t('billTiming')}
                value={healthScore.components.bill_timing}
                color={colors.palette.cyan}
              />
            </View>

            {/* Tips */}
            {healthScore.tips && healthScore.tips.length > 0 && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                  <Info size={14} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginStart: theme.spacing.xs, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                    {t('tipsToImprove')}
                  </Text>
                </View>
                {healthScore.tips.slice(0, 2).map((tip, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.xs }}>
                    <Text style={{ color: colors.accent, marginEnd: theme.spacing.sm }}>•</Text>
                    <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={{ backgroundColor: theme.alpha(colors.muted, 0.5), padding: theme.spacing.xxl, borderRadius: theme.radii.sm, alignItems: 'center' }}>
            <Heart size={32} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: theme.spacing.sm }}>
              {t('addTransactionsForScore')}
            </Text>
          </View>
        )}
      </Card>

      <BottomSheet
        ref={methodologySheetRef}
        title={t('healthScoreHowItWorksTitle')}
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20, marginBottom: theme.spacing.lg }}>
          {t('healthScoreMethodologySummary')}
        </Text>

        <View style={{ marginBottom: theme.spacing.lg }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: theme.typography.h2.fontFamily, marginBottom: theme.spacing.sm }}>
            {t('healthScoreWeightsTitle')}
          </Text>
        </View>
        {scoreWeights.map((item) => (
          <View key={item} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
            <Text style={{ color: colors.info, marginEnd: theme.spacing.sm }}>•</Text>
            <Text style={{ flex: 1, color: colors.foreground, fontSize: 14, lineHeight: 20 }}>{item}</Text>
          </View>
        ))}

        <View style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: theme.typography.h2.fontFamily, marginBottom: theme.spacing.sm }}>
            {t('healthScoreWindowsTitle')}
          </Text>
          {scoreWindows.map((item) => (
            <View key={item} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
              <Text style={{ color: colors.info, marginEnd: theme.spacing.sm }}>•</Text>
              <Text style={{ flex: 1, color: colors.foreground, fontSize: 14, lineHeight: 20 }}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginBottom: theme.spacing.lg }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: theme.typography.h2.fontFamily, marginBottom: theme.spacing.sm }}>
            {t('healthScoreTrendTitle')}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>
            {t('healthScoreTrendExplanation')}
          </Text>
        </View>

        <View style={{ backgroundColor: theme.alpha(colors.warning, 0.08), borderRadius: 10, padding: theme.spacing.md }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: theme.typography.h2.fontFamily, marginBottom: 6 }}>
            {t('healthScoreProxyNoteTitle')}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>
            {t('healthScoreProxyNoteBody')}
          </Text>
        </View>
      </BottomSheet>
    </>
  );
}
