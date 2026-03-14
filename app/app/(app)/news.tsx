import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, Pressable, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';
import { ArrowLeft, Rss, Clock, AlertTriangle, ChevronRight, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { api } from '../../src/api';
import { useRefreshControl } from '../../src/hooks/useRefreshableQuery';
import { formatDate } from '../../src/utils/format';
import { useLanguage } from '../../src/context/LanguageContext';
import { PageHeader, PageScaffold } from '../../src/components/ui';
import { H2, H3, BodyMedium, Caption } from '../../src/components/ui/styled';
import { Skeleton, SkeletonList } from '../../src/components/ui/Skeleton';
import { useScreenLayout } from '../../src/hooks/useScreenLayout';

export default function DailyBriefingScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDesktop, width } = useScreenLayout();
  const contentWidth = Math.min(width, 1280);

  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['news', 'summary'],
    queryFn: api.news.summary,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const { data: latestNews, isLoading: isNewsLoading, refetch: refetchNews } = useQuery({
    queryKey: ['news', 'latest'],
    queryFn: () => api.news.list(15),
    staleTime: 1000 * 60 * 15, // 15 mins
  });

  const { refreshing, onRefresh } = useRefreshControl(async () => {
    await Promise.all([refetchSummary(), refetchNews()]);
  });

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp size={20} color={theme.colors.success} />;
      case 'negative':
        return <TrendingDown size={20} color={theme.colors.danger} />;
      case 'volatile':
        return <Activity size={20} color={theme.colors.warning} />;
      default:
        return <Minus size={20} color={theme.colors.mutedForeground} />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return theme.colors.success;
      case 'negative': return theme.colors.danger;
      case 'volatile': return theme.colors.warning;
      default: return theme.colors.mutedForeground;
    }
  };

  return (
    <PageScaffold
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />,
      }}
    >
      <PageHeader
        title={t('dailyBriefing') || 'Daily Briefing'}
        backHref="../"
      />
      <View style={{ gap: theme.spacing.xl, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: contentWidth, alignSelf: 'center' }}>
        
        {/* Top Summary Section */}
        <View>
          {isSummaryLoading ? (
            <Skeleton style={{ height: 280, borderRadius: theme.radii.lg }} />
          ) : summary ? (
            <View style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              borderColor: summary.has_breaking_news ? theme.colors.danger : theme.colors.border,
              overflow: 'hidden',
              ...theme.shadows.md,
            }}>
              {/* Header Strip */}
              <View style={{
                backgroundColor: summary.has_breaking_news ? theme.colors.danger + '20' : theme.colors.muted,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: summary.has_breaking_news ? theme.colors.danger + '40' : theme.colors.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  {summary.has_breaking_news ? (
                    <AlertTriangle size={18} color={theme.colors.danger} />
                  ) : (
                    <Rss size={18} color={theme.colors.primary} />
                  )}
                  <H3 $color={summary.has_breaking_news ? theme.colors.danger : theme.colors.foreground} style={{ fontSize: 16 }}>
                    {summary.has_breaking_news ? (t('breakingNews') || 'BREAKING NEWS') : (t('globalOutlook') || 'Global Outlook')}
                  </H3>
                </View>
                <Caption>{formatDate(summary.date)}</Caption>
              </View>

              {/* Summary Body */}
              <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
                    <H3 style={{ fontSize: 18, color: theme.colors.foreground }}>
                      {t('todaysSummary') || "Today's Summary"}
                    </H3>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.muted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 }}>
                      {getSentimentIcon(summary.sentiment)}
                      <Caption style={{ color: getSentimentColor(summary.sentiment), textTransform: 'capitalize' }}>{summary.sentiment}</Caption>
                    </View>
                  </View>
                  <BodyMedium style={{ lineHeight: 24, fontSize: 15, color: theme.colors.secondaryForeground }}>
                    {summary.summary}
                  </BodyMedium>
                </View>

                {/* Recommendations */}
                {summary.recommendations && summary.recommendations.length > 0 && (
                  <View style={{ backgroundColor: theme.colors.background, padding: theme.spacing.md, borderRadius: theme.radii.md }}>
                    <H3 style={{ fontSize: 16, color: theme.colors.foreground, marginBottom: theme.spacing.sm }}>
                      {t('actionableInsights') || 'Actionable Insights'}
                    </H3>
                    <View style={{ gap: theme.spacing.sm }}>
                      {summary.recommendations.map((rec, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
                          <View style={{ marginTop: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary }} />
                          <BodyMedium style={{ flex: 1, fontSize: 14 }}>{rec}</BodyMedium>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border }}>
              <Caption>{t('noSummaryAvailable') || 'No briefing generated.'}</Caption>
            </View>
          )}
        </View>

        {/* Latest News Feed */}
        <View>
          <H2 style={{ fontSize: 20, marginBottom: theme.spacing.md }}>{t('latestHeadlines') || 'Latest Headlines'}</H2>
          
          {isNewsLoading ? (
            <SkeletonList count={5} ItemComponent={() => <Skeleton style={{ height: 80, marginBottom: theme.spacing.sm, borderRadius: theme.radii.md }} />} />
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {latestNews?.map((news, idx) => {
                const isBreaking = news.category.toLowerCase().includes('breaking') || news.title.toLowerCase().includes('breaking');
                return (
                 <Pressable
                   key={`${news.url}-${idx}`}
                   onPress={() => Linking.openURL(news.url).catch(console.error)}
                   style={({ pressed }) => [
                     {
                       backgroundColor: theme.colors.card,
                       borderRadius: theme.radii.md,
                       padding: theme.spacing.md,
                       flexDirection: 'row',
                       alignItems: 'center',
                       borderWidth: 1,
                       borderColor: isBreaking ? theme.colors.danger + '40' : theme.colors.border,
                       ...theme.shadows.sm,
                     },
                     pressed && { opacity: 0.7 }
                   ]}
                 >
                   <View style={{ flex: 1, gap: 6 }}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                       {isBreaking && (
                         <View style={{ backgroundColor: theme.colors.danger + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                           <Caption style={{ fontSize: 10, color: theme.colors.danger, fontFamily: 'Inter_700Bold' }}>BREAKING</Caption>
                         </View>
                       )}
                       <Caption style={{ color: theme.colors.primary, fontFamily: 'Inter_600SemiBold' }}>{news.source}</Caption>
                       <Caption>• {formatDate(news.published_at)}</Caption>
                     </View>
                     <BodyMedium style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15 }} numberOfLines={2}>
                       {news.title}
                     </BodyMedium>
                     {news.description && (
                       <Caption numberOfLines={2} style={{ color: theme.colors.mutedForeground, marginTop: 4 }}>
                         {news.description}
                       </Caption>
                     )}
                   </View>
                   <ChevronRight size={20} color={theme.colors.mutedForeground} style={{ marginStart: theme.spacing.sm }} />
                 </Pressable>
                );
              })}
            </View>
          )}
        </View>

      </View>
    </PageScaffold>
  );
}
