import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Target, Lock, Award, ChevronLeft, RefreshCw, Gift, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { Card } from '../../src/components/ui';
import { haptics } from '../../src/utils/haptics';
import { useToast } from '../../src/components/ui/Toast';

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

function getRarityStyles(rarity: string, colors: any) {
  switch (rarity) {
    case 'rare':
      return { bg: '#3b82f51a', border: '#3b82f54d', text: '#3b82f5' };
    case 'epic':
      return { bg: '#a855f71a', border: '#a855f74d', text: '#a855f7' };
    case 'legendary':
      return { bg: '#f59e0b1a', border: '#f59e0b4d', text: '#f59e0b' };
    default: // common
      return { bg: colors.muted, border: colors.border, text: colors.mutedForeground };
  }
}

function BadgeCard({ progress }: { progress: BadgeProgress }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { badge, is_earned, progress_percent, current_value, required_value } = progress;
  const style = getRarityStyles(badge.rarity, colors);

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        backgroundColor: style.bg,
        borderColor: style.border,
        opacity: is_earned ? 1 : 0.6,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 36, marginBottom: 8 }}>{badge.icon}</Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Inter_600SemiBold',
            textAlign: 'center',
            marginBottom: 4,
            color: is_earned ? colors.foreground : colors.mutedForeground,
          }}
          numberOfLines={2}
        >
          {badge.name}
        </Text>
        <Text style={{ fontSize: 12, textTransform: 'uppercase', color: style.text }}>{badge.rarity}</Text>

        {!is_earned && progress_percent > 0 && (
          <View style={{ width: '100%', marginTop: 8 }}>
            <View style={{ width: '100%', height: 6, backgroundColor: colors.muted, borderRadius: 9999, overflow: 'hidden' }}>
              <View
                style={{ height: '100%', backgroundColor: colors.primary, borderRadius: 9999, width: `${Math.min(progress_percent, 100)}%` }}
              />
            </View>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
              {Math.round(current_value)}/{Math.round(required_value)}
            </Text>
          </View>
        )}

        {is_earned && (
          <View style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, backgroundColor: colors.success, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'white', fontSize: 12 }}>✓</Text>
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [{ cursor: 'pointer', padding: 8, marginRight: 8 }, pressed && { opacity: 0.7 }]}
              accessibilityLabel={t('back') || 'Go back'}
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
            style={({ pressed }) => [{ cursor: 'pointer', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t('claimRewards') || 'Claim Rewards'}
            accessibilityRole="button"
          >
            {checkBadgesMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Gift size={18} color={colors.primaryForeground} />
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>
                  {t('claimRewards') || 'Claim Rewards'}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Newly Earned Badges Alert */}
        {showNewlyEarned && checkBadgesMutation.data?.newly_earned && checkBadgesMutation.data.newly_earned.length > 0 && (
          <View style={{ backgroundColor: colors.success + '1a', borderWidth: 1, borderColor: colors.success + '4d', padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: colors.success, fontFamily: 'Inter_600SemiBold' }}>
                🎉 {t('newBadgesEarned') || 'New Badges Earned!'}
              </Text>
              <Pressable onPress={() => setShowNewlyEarned(false)} style={{ cursor: 'pointer', padding: 4 }}>
                <X size={18} color={colors.success} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {checkBadgesMutation.data.newly_earned.map((badge: any) => (
                <View key={badge.badge_id} style={{ backgroundColor: colors.success + '33', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 }}>
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
          <View style={{ backgroundColor: colors.danger + '1a', padding: 16, borderRadius: 12 }}>
            <Text style={{ color: colors.danger, textAlign: 'center' }}>Error loading badges</Text>
          </View>
        ) : (
          <View style={{ gap: 24 }}>
            {/* Stats */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card style={{ padding: 16, alignItems: 'center' }}>
                  <Trophy size={24} color={colors.accent} />
                  <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.primary, marginTop: 8 }}>
                    {data?.earned_count || 0}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {t('badgesEarned') || 'Earned'}
                  </Text>
                </Card>
              </View>
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card style={{ padding: 16, alignItems: 'center' }}>
                  <Target size={24} color={colors.warning} />
                  <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: '#f59e0b', marginTop: 8 }}>
                    {inProgress.length}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {t('inProgress') || 'In Progress'}
                  </Text>
                </Card>
              </View>
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card style={{ padding: 16, alignItems: 'center' }}>
                  <Lock size={24} color={colors.placeholder} />
                  <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, marginTop: 8 }}>
                    {locked.length}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {t('locked') || 'Locked'}
                  </Text>
                </Card>
              </View>
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card style={{ padding: 16, alignItems: 'center' }}>
                  <Award size={24} color={colors.placeholder} />
                  <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginTop: 8 }}>
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
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 12 }}>
                  <Text>🏆 {t('earnedBadges') || 'Earned Badges'} ({earned.length})</Text>
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 12,
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
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 12 }}>
                  🎯 {t('inProgressBadges') || 'In Progress'} ({inProgress.length})
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 12,
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
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 12 }}>
                  🔒 {t('lockedBadges') || 'Locked'} ({locked.length})
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 12,
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
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Text style={{ fontSize: 60, marginBottom: 16 }}>🎖️</Text>
                <Text style={{ fontSize: 18, fontFamily: 'Inter_500Medium', color: colors.foreground, marginBottom: 4 }}>
                  {t('noBadgesYet') || 'No badges yet'}
                </Text>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                  {t('startEarningBadges') || 'Start using CoFinance to earn achievements!'}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
