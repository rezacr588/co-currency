import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Target, Lock, Award, ChevronLeft, RefreshCw, Gift, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import type { AppTheme } from '../../src/theme';
import { Card } from '../../src/components/ui';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { haptics } from '../../src/utils/haptics';
import { useToast } from '../../src/components/ui/Toast';
import { HIT_SLOP_SM } from '../../src/constants/hitSlop';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: string;
}

interface BadgeProgress {
  badge: Badge;
  is_earned: boolean;
  progress_percent: number;
  current_value: number;
  required_value: number;
  earned_at?: string;
}

function getRarityStyles(rarity: string, theme: AppTheme) {
  const { colors } = theme;
  switch (rarity) {
    case 'rare':
      return {
        bg: theme.alpha(colors.palette.blue, 0.1),
        border: theme.alpha(colors.palette.blue, 0.3),
        text: colors.palette.blue,
      };
    case 'epic':
      return {
        bg: theme.alpha(colors.palette.purple, 0.1),
        border: theme.alpha(colors.palette.purple, 0.3),
        text: colors.palette.purple,
      };
    case 'legendary':
      return {
        bg: theme.alpha(colors.palette.yellow, 0.1),
        border: theme.alpha(colors.palette.yellow, 0.3),
        text: colors.palette.yellow,
      };
    default: // common
      return { bg: colors.muted, border: colors.border, text: colors.mutedForeground };
  }
}

function BadgeCard({ progress }: { progress: BadgeProgress }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { badge, is_earned, progress_percent, current_value, required_value } = progress;
  const style = getRarityStyles(badge.rarity, theme);

  return (
    <View
      style={{
        padding: theme.spacing.lg,
        borderRadius: theme.radii.md,
        borderWidth: 2,
        backgroundColor: style.bg,
        borderColor: style.border,
        opacity: is_earned ? 1 : 0.6,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 36, marginBottom: theme.spacing.sm }}>{badge.icon}</Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Inter_600SemiBold',
            textAlign: 'center',
            marginBottom: theme.spacing.xs,
            color: is_earned ? colors.foreground : colors.mutedForeground,
          }}
          numberOfLines={2}
        >
          {badge.name}
        </Text>
        <Text style={{ fontSize: 12, textTransform: 'uppercase', color: style.text }}>{badge.rarity}</Text>

        {!is_earned && progress_percent > 0 && (
          <View style={{ width: '100%', marginTop: theme.spacing.sm }}>
            <View style={{ width: '100%', height: 6, backgroundColor: colors.muted, borderRadius: theme.radii.full, overflow: 'hidden' }}>
              <View
                style={{ height: '100%', backgroundColor: colors.primary, borderRadius: theme.radii.full, width: `${Math.min(progress_percent, 100)}%` }}
              />
            </View>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: theme.spacing.xs }}>
              {Math.round(current_value)}/{Math.round(required_value)}
            </Text>
          </View>
        )}

        {is_earned && (
          <View style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, backgroundColor: colors.success, borderRadius: theme.radii.full, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.primaryForeground, fontSize: 12 }}>✓</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function BadgesScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const { showToast } = useToast();
  const theme = useTheme();
  const colors = theme.colors;
  const [showNewlyEarned, setShowNewlyEarned] = useState(false);

  const isLargeScreen = width > 768;
  const numColumns = width > 1024 ? 6 : width > 768 ? 4 : width > 480 ? 3 : 2;

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['badges', 'progress'],
    queryFn: () => api.badges.getProgress(),
  });

  // Mutation to check and claim new badges
  const checkBadgesMutation = useMutation({
    mutationFn: () => api.badges.check(),
    onSuccess: (result) => {
      // Refresh badge progress after checking
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      if (result.newly_earned && result.newly_earned.length > 0) {
        haptics.success();
        setShowNewlyEarned(true);
      } else {
        showToast(t('noNewBadges') || 'No new badges to claim', 'info');
      }
    },
    onError: () => {
      showToast(t('failedToCheckBadges') || 'Failed to check badges', 'error');
    },
  });

  const handleClaimRewards = () => {
    haptics.medium();
    checkBadgesMutation.mutate();
  };

  const earned = data?.progress?.filter((p: BadgeProgress) => p.is_earned) || [];
  const inProgress =
    data?.progress?.filter((p: BadgeProgress) => !p.is_earned && p.progress_percent > 0) || [];
  const locked =
    data?.progress?.filter((p: BadgeProgress) => !p.is_earned && p.progress_percent === 0) || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.spacing.lg }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [{ cursor: 'pointer', padding: theme.spacing.sm, marginEnd: theme.spacing.sm }, pressed && { opacity: 0.7 }]}
              accessibilityLabel={t('a11yBack') || t('back') || 'Go back'}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={24} color={colors.placeholder} />
            </Pressable>
            <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
              {t('badges') || 'Badges'}
            </Text>
          </View>
          <Pressable
            onPress={handleClaimRewards}
            disabled={checkBadgesMutation.isPending}
            style={({ pressed }) => [{ cursor: 'pointer', backgroundColor: colors.primary, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.radii.md, flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t('claimRewards') || 'Claim Rewards'}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {checkBadgesMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Gift size={18} color={colors.primaryForeground} />
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', marginStart: theme.spacing.sm }}>
                  {t('claimRewards') || 'Claim Rewards'}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Newly Earned Badges Alert */}
        {showNewlyEarned && checkBadgesMutation.data?.newly_earned && checkBadgesMutation.data.newly_earned.length > 0 && (
          <View style={{ backgroundColor: theme.alpha(colors.success, 0.1), borderWidth: 1, borderColor: theme.alpha(colors.success, 0.3), padding: theme.spacing.lg, borderRadius: theme.radii.md, marginBottom: theme.spacing.xxl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
              <Text style={{ color: colors.success, fontFamily: 'Inter_600SemiBold' }}>
                🎉 {t('newBadgesEarned') || 'New Badges Earned!'}
              </Text>
              <Pressable
                onPress={() => setShowNewlyEarned(false)}
                hitSlop={HIT_SLOP_SM}
                style={{ cursor: 'pointer', padding: theme.spacing.xs }}
                accessibilityLabel={t('a11yClose') || t('close') || 'Close'}
                accessibilityRole="button"
              >
                <X size={18} color={colors.success} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm }}>
              {checkBadgesMutation.data.newly_earned.map((badge: any) => (
                <View key={badge.badge_id} style={{ backgroundColor: theme.alpha(colors.success, 0.2), paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.full }}>
                  <Text style={{ color: colors.success, fontSize: 14 }}>
                    {badge.badge?.icon} {badge.badge?.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {isPending ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : error ? (
          <View style={{ backgroundColor: theme.alpha(colors.danger, 0.1), padding: theme.spacing.lg, borderRadius: theme.radii.md }}>
            <Text style={{ color: colors.danger, textAlign: 'center' }}>{t('failedToLoadBadges') || 'Error loading badges'}</Text>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.xxl }}>
            {/* Stats */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.md,
              }}
            >
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card style={{ padding: theme.spacing.lg, alignItems: 'center' }}>
                  <Trophy size={24} color={colors.accent} />
                  <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.primary, marginTop: theme.spacing.sm }}>
                    {data?.earned_count || 0}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {t('badgesEarned') || 'Earned'}
                  </Text>
                </Card>
              </View>
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card style={{ padding: theme.spacing.lg, alignItems: 'center' }}>
                  <Target size={24} color={colors.warning} />
                  <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.warning, marginTop: theme.spacing.sm }}>
                    {inProgress.length}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {t('inProgress') || 'In Progress'}
                  </Text>
                </Card>
              </View>
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card style={{ padding: theme.spacing.lg, alignItems: 'center' }}>
                  <Lock size={24} color={colors.placeholder} />
                  <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, marginTop: theme.spacing.sm }}>
                    {locked.length}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {t('locked') || 'Locked'}
                  </Text>
                </Card>
              </View>
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card style={{ padding: theme.spacing.lg, alignItems: 'center' }}>
                  <Award size={24} color={colors.placeholder} />
                  <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginTop: theme.spacing.sm }}>
                    {data?.total_badges || 0}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {t('totalBadges') || 'Total'}
                  </Text>
                </Card>
              </View>
            </View>

            {/* Earned Badges */}
            {earned.length > 0 && (
              <View>
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: theme.spacing.md }}>
                  <Text>🏆 {t('earnedBadges') || 'Earned Badges'} ({earned.length})</Text>
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.md,
                  }}
                >
                  {earned.map((progress: BadgeProgress) => (
                    <View key={progress.badge.id} style={{ width: `${100 / numColumns - 3}%` }}>
                      <BadgeCard progress={progress} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* In Progress Badges */}
            {inProgress.length > 0 && (
              <View>
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: theme.spacing.md }}>
                  🎯 {t('inProgressBadges') || 'In Progress'} ({inProgress.length})
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.md,
                  }}
                >
                  {inProgress.map((progress: BadgeProgress) => (
                    <View key={progress.badge.id} style={{ width: `${100 / numColumns - 3}%` }}>
                      <BadgeCard progress={progress} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Locked Badges */}
            {locked.length > 0 && (
              <View>
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: theme.spacing.md }}>
                  🔒 {t('lockedBadges') || 'Locked'} ({locked.length})
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.md,
                  }}
                >
                  {locked.map((progress: BadgeProgress) => (
                    <View key={progress.badge.id} style={{ width: `${100 / numColumns - 3}%` }}>
                      <BadgeCard progress={progress} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Empty State */}
            {data?.progress?.length === 0 && (
              <EmptyState
                icon={Trophy}
                title={t('emptyNoBadgesTitle') || 'No badges earned yet'}
                description={t('emptyNoBadgesDesc') || 'Complete activities to earn badges.'}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
