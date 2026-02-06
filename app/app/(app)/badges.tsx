import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Target, Lock, Award, ChevronLeft, RefreshCw, Gift, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
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

const RARITY_STYLES = {
  common: {
    bg: 'bg-muted',
    border: 'border-border',
    text: 'text-muted-foreground',
  },
  rare: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-500',
  },
  epic: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-500',
  },
  legendary: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-500',
  },
};

function BadgeCard({ progress }: { progress: BadgeProgress }) {
  const { badge, is_earned, progress_percent, current_value, required_value } = progress;
  const style = RARITY_STYLES[badge.rarity] || RARITY_STYLES.common;

  return (
    <View
      className={`p-4 rounded-xl border-2 ${style.bg} ${style.border} ${
        is_earned ? '' : 'opacity-60'
      }`}
    >
      <View className="items-center">
        <Text className="text-4xl mb-2">{badge.icon}</Text>
        <Text
          className={`text-sm font-semibold text-center mb-1 ${
            is_earned ? 'text-foreground' : 'text-muted-foreground'
          }`}
          numberOfLines={2}
        >
          {badge.name}
        </Text>
        <Text className={`text-xs uppercase ${style.text}`}>{badge.rarity}</Text>

        {!is_earned && progress_percent > 0 && (
          <View className="w-full mt-2">
            <View className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(progress_percent, 100)}%` }}
              />
            </View>
            <Text className="text-xs text-muted-foreground text-center mt-1">
              {Math.round(current_value)}/{Math.round(required_value)}
            </Text>
          </View>
        )}

        {is_earned && (
          <View className="absolute -top-1 -right-1 w-5 h-5 bg-success rounded-full items-center justify-center">
            <Text className="text-white text-xs">✓</Text>
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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => router.back()}
              style={{ cursor: 'pointer' }}
              className="p-2 mr-2"
            >
              <ChevronLeft size={24} color="rgb(148, 163, 184)" />
            </Pressable>
            <Text className="text-2xl font-bold text-foreground">
              {t('badges') || 'Badges'}
            </Text>
          </View>
          <Pressable
            onPress={handleClaimRewards}
            disabled={checkBadgesMutation.isPending}
            style={{ cursor: 'pointer' }}
            className="bg-primary px-4 py-2 rounded-xl flex-row items-center"
          >
            {checkBadgesMutation.isPending ? (
              <ActivityIndicator size="small" color="#09090b" />
            ) : (
              <>
                <Gift size={18} color="#09090b" />
                <Text className="text-primary-foreground font-semibold ml-2">
                  {t('claimRewards') || 'Claim Rewards'}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Newly Earned Badges Alert */}
        {showNewlyEarned && checkBadgesMutation.data?.newly_earned && checkBadgesMutation.data.newly_earned.length > 0 && (
          <View className="bg-success/10 border border-success/30 p-4 rounded-xl mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-success font-semibold">
                🎉 {t('newBadgesEarned') || 'New Badges Earned!'}
              </Text>
              <Pressable onPress={() => setShowNewlyEarned(false)} style={{ cursor: 'pointer' }} className="p-1">
                <X size={18} color="rgb(34, 197, 94)" />
              </Pressable>
            </View>
            <View className="flex-row flex-wrap justify-center gap-2">
              {checkBadgesMutation.data.newly_earned.map((badge: any) => (
                <View key={badge.badge_id} className="bg-success/20 px-3 py-1 rounded-full">
                  <Text className="text-success text-sm">
                    {badge.badge?.icon} {badge.badge?.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {isPending ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
          </View>
        ) : error ? (
          <View className="bg-danger/10 p-4 rounded-xl">
            <Text className="text-danger text-center">Error loading badges</Text>
          </View>
        ) : (
          <View className="gap-6">
            {/* Stats */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card className="p-4 items-center">
                  <Trophy size={24} color="rgb(212, 175, 55)" />
                  <Text className="text-2xl font-bold text-primary mt-2">
                    {data?.earned_count || 0}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t('badgesEarned') || 'Earned'}
                  </Text>
                </Card>
              </View>
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card className="p-4 items-center">
                  <Target size={24} color="rgb(251, 191, 36)" />
                  <Text className="text-2xl font-bold text-amber-500 mt-2">
                    {inProgress.length}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t('inProgress') || 'In Progress'}
                  </Text>
                </Card>
              </View>
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card className="p-4 items-center">
                  <Lock size={24} color="rgb(148, 163, 184)" />
                  <Text className="text-2xl font-bold text-muted-foreground mt-2">
                    {locked.length}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t('locked') || 'Locked'}
                  </Text>
                </Card>
              </View>
              <View style={{ flex: 1, minWidth: isLargeScreen ? 150 : '45%' }}>
                <Card className="p-4 items-center">
                  <Award size={24} color="rgb(148, 163, 184)" />
                  <Text className="text-2xl font-bold text-foreground mt-2">
                    {data?.total_badges || 0}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t('totalBadges') || 'Total'}
                  </Text>
                </Card>
              </View>
            </View>

            {/* Earned Badges */}
            {earned.length > 0 && (
              <View>
                <Text className="text-lg font-semibold text-foreground mb-3 flex-row items-center">
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
                <Text className="text-lg font-semibold text-foreground mb-3">
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
                <Text className="text-lg font-semibold text-foreground mb-3">
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
              <View className="items-center py-12">
                <Text className="text-6xl mb-4">🎖️</Text>
                <Text className="text-lg font-medium text-foreground mb-1">
                  {t('noBadgesYet') || 'No badges yet'}
                </Text>
                <Text className="text-muted-foreground text-center">
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
