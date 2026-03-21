/**
 * Financial DNA Screen
 * Shows user's financial personality profile and behavioral insights
 */

import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw, Brain, TrendingUp, Shield, Clock, Zap, ChevronRight } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '@/src/context/LanguageContext';
import { useFinancialDNA, useRefreshDNA, useInsights } from '@/src/hooks/useDNA';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { useToast } from '@/src/components/ui/Toast';
import { haptics } from '@/src/utils/haptics';
import type { DNADimension, BehavioralInsight } from '@/src/api/dna';

function DimensionBar({ dimension }: { dimension: DNADimension }) {
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground }}>
          {dimension.name}
        </Text>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.accent }}>
          {dimension.label}
        </Text>
      </View>
      <ProgressBar progress={dimension.score / 100} height="md" />
      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
        {dimension.description}
      </Text>
    </View>
  );
}

function InsightCard({ insight, onPress }: { insight: BehavioralInsight; onPress: () => void }) {
  const theme = useTheme();
  const colors = theme.colors;

  const impactColor = insight.impact === 'positive' ? colors.success
    : insight.impact === 'negative' ? colors.danger : colors.muted;

  const severityBg = insight.severity === 'high' ? colors.danger + '20'
    : insight.severity === 'medium' ? colors.warning + '20' : colors.info + '20';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: insight.is_read ? colors.border : colors.accent,
        borderLeftWidth: 4,
        borderLeftColor: impactColor,
      }, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={{ backgroundColor: severityBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.foreground, textTransform: 'capitalize' }}>
                {insight.category}
              </Text>
            </View>
            {!insight.is_read && (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
            )}
          </View>
          <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 4 }}>
            {insight.title}
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }} numberOfLines={2}>
            {insight.description}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.muted} />
      </View>
    </Pressable>
  );
}

export default function DNAScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const { showToast } = useToast();

  const { data: dna, isLoading: dnaLoading, refetch: refetchDNA, isRefetching } = useFinancialDNA();
  const { data: insightsData, isLoading: insightsLoading } = useInsights(10);
  const refreshDNA = useRefreshDNA();

  const handleRefresh = useCallback(async () => {
    haptics.medium();
    try {
      await refreshDNA.mutateAsync();
      haptics.success();
      showToast(t('dnaRefreshed') || 'DNA profile refreshed', 'success');
    } catch (err: any) {
      haptics.error();
      showToast(err?.message || t('failedToRefresh') || 'Failed to refresh', 'error');
    }
  }, [refreshDNA, showToast, t]);

  const handleInsightPress = useCallback((insight: BehavioralInsight) => {
    haptics.light();
    // Could navigate to insight detail or mark as read
  }, []);

  if (dnaLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <LoadingSpinner size="large" />
        <Text style={{ color: colors.muted, marginTop: 16 }}>{t('analyzingDNA') || 'Analyzing your financial DNA...'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ padding: 8, marginEnd: 8 }, pressed && { opacity: 0.7 }]} hitSlop={8}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {t('financialDNA') || 'Financial DNA'}
          </Text>
        </View>
        <Button onPress={handleRefresh} disabled={refreshDNA.isPending} variant="outline" size="sm">
          <RefreshCw size={16} color={colors.foreground} style={refreshDNA.isPending ? { opacity: 0.5 } : undefined} />
        </Button>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchDNA} tintColor={colors.accent} />
        }
      >
        {dna && (
          <>
            {/* Archetype Card */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <Text style={{ fontSize: 48, marginBottom: 8 }}>{dna.archetype_emoji}</Text>
              <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center', marginBottom: 4 }}>
                {dna.archetype_label}
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 16 }}>
                {t('basedOn') || 'Based on'} {dna.transactions_analyzed} {t('transactions') || 'transactions'}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ backgroundColor: colors.success + '20', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.success }}>
                    {Math.round(dna.confidence_score * 100)}% {t('confidence') || 'confidence'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Strengths & Growth */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1, backgroundColor: colors.success + '10', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.success + '30' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.success, marginBottom: 8 }}>
                  💪 {t('strengths') || 'Strengths'}
                </Text>
                {dna.strengths.map((s, i) => (
                  <Text key={i} style={{ fontSize: 13, color: colors.foreground, lineHeight: 18 }}>• {s}</Text>
                ))}
              </View>
              <View style={{ flex: 1, backgroundColor: colors.warning + '10', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.warning + '30' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.warning, marginBottom: 8 }}>
                  🎯 {t('growthAreas') || 'Growth Areas'}
                </Text>
                {dna.growth_areas.map((g, i) => (
                  <Text key={i} style={{ fontSize: 13, color: colors.foreground, lineHeight: 18 }}>• {g}</Text>
                ))}
              </View>
            </View>

            {/* Dimensions */}
            <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 16 }}>
                {t('personalityDimensions') || 'Personality Dimensions'}
              </Text>
              {dna.dimensions.map((dim, i) => (
                <DimensionBar key={i} dimension={dim} />
              ))}
            </View>
          </>
        )}

        {/* Insights Section */}
        {insightsData && insightsData.insights.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                {t('behavioralInsights') || 'Behavioral Insights'}
              </Text>
              {insightsData.unread_count > 0 && (
                <View style={{ backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.background }}>
                    {insightsData.unread_count} {t('new') || 'new'}
                  </Text>
                </View>
              )}
            </View>
            {insightsData.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} onPress={() => handleInsightPress(insight)} />
            ))}
          </View>
        )}

        {!dna && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Brain size={64} color={colors.muted} />
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginTop: 16, textAlign: 'center' }}>
              {t('notEnoughData') || 'Not Enough Data'}
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 8 }}>
              {t('addMoreTransactions') || 'Add more transactions to discover your financial personality'}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
