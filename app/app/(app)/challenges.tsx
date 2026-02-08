import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Trophy,
  Target,
  Flame,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Ban,
  PiggyBank,
  Coffee,
  Wallet,
  Utensils,
  Zap,
  ShoppingBag,
  Award,
} from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme, useColors } from '../../src/context/ThemeContext';
import { haptics } from '../../src/utils/haptics';
import { Button } from '../../src/components/ui/Button';
import type {
  Challenge,
  ChallengeWithUserStatus,
  UserChallenge,
  ChallengeStats,
  ChallengeDifficulty,
} from '../../src/types/challenge';

function useDifficultyColors(): Record<ChallengeDifficulty, string> {
  const colors = useColors();
  return {
    easy: colors.success,
    medium: colors.warning,
    hard: colors.danger,
  };
}

const getChallengeIcon = (iconName: string, color: string, size: number = 24) => {
  const props = { size, color };
  switch (iconName) {
    case 'ban': return <Ban {...props} />;
    case 'piggy-bank': return <PiggyBank {...props} />;
    case 'coffee': return <Coffee {...props} />;
    case 'trophy': return <Trophy {...props} />;
    case 'wallet': return <Wallet {...props} />;
    case 'utensils': return <Utensils {...props} />;
    case 'zap': return <Zap {...props} />;
    case 'shopping-bag': return <ShoppingBag {...props} />;
    default: return <Target {...props} />;
  }
};

export default function ChallengesScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = useColors();
  const DIFFICULTY_COLORS = useDifficultyColors();

  const isDesktop = width >= 1024;
  const bottomPadding = isDesktop ? insets.bottom : insets.bottom + 96;
  const iconColor = colors.foreground;

  const [refreshing, setRefreshing] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeWithUserStatus | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [tab, setTab] = useState<'browse' | 'active' | 'history'>('browse');

  // Queries
  const { data: browseData, isPending: browsePending, refetch: refetchBrowse } = useQuery({
    queryKey: ['challenges', 'browse'],
    queryFn: () => api.challenges.browse(),
    enabled: tab === 'browse',
  });

  const { data: activeData, isPending: activePending, refetch: refetchActive } = useQuery({
    queryKey: ['challenges', 'active'],
    queryFn: () => api.challenges.getActive(),
    enabled: tab === 'active',
  });

  const { data: historyData, isPending: historyPending, refetch: refetchHistory } = useQuery({
    queryKey: ['challenges', 'history'],
    queryFn: () => api.challenges.getHistory(),
    enabled: tab === 'history',
  });

  const { data: statsData } = useQuery({
    queryKey: ['challenges', 'stats'],
    queryFn: () => api.challenges.getStats(),
  });

  const stats = statsData?.stats;

  // Mutations
  const joinMutation = useMutation({
    mutationFn: (challengeId: string) => api.challenges.join({ challenge_id: challengeId }),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      setShowDetailsModal(false);
      Alert.alert(
        t('success') || 'Success',
        t('challengeJoined') || 'You have joined the challenge!'
      );
    },
    onError: (err) => {
      haptics.error();
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : t('failedToJoin') || 'Failed to join challenge'
      );
    },
  });

  const abandonMutation = useMutation({
    mutationFn: (challengeId: string) => api.challenges.abandon(challengeId),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      setShowDetailsModal(false);
    },
    onError: (err) => {
      haptics.error();
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : t('failedToAbandon') || 'Failed to abandon challenge'
      );
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (tab === 'browse') await refetchBrowse();
    else if (tab === 'active') await refetchActive();
    else await refetchHistory();
    setRefreshing(false);
  }, [tab, refetchBrowse, refetchActive, refetchHistory]);

  const handleJoin = () => {
    if (!selectedChallenge) return;
    joinMutation.mutate(selectedChallenge.id);
  };

  const handleAbandon = (challengeId: string) => {
    Alert.alert(
      t('abandonChallenge') || 'Abandon Challenge',
      t('abandonConfirm') || 'Are you sure? Your progress will be lost.',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('abandon') || 'Abandon',
          style: 'destructive',
          onPress: () => abandonMutation.mutate(challengeId),
        },
      ]
    );
  };

  const openDetails = (challenge: ChallengeWithUserStatus) => {
    haptics.light();
    setSelectedChallenge(challenge);
    setShowDetailsModal(true);
  };

  const renderBrowseList = () => {
    if (browsePending) {
      return (
        <View className="items-center py-8">
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }

    const challenges = browseData?.challenges || [];
    if (challenges.length === 0) {
      return (
        <View className="bg-card border border-border p-8 rounded-xl items-center">
          <Trophy size={48} color={colors.mutedForeground} />
          <Text className="text-muted-foreground text-center mt-4">
            {t('noChallenges') || 'No challenges available'}
          </Text>
        </View>
      );
    }

    return (
      <View className="gap-3">
        {challenges.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            onPress={() => openDetails(challenge)}
            isDark={isDark}
          />
        ))}
      </View>
    );
  };

  const renderActiveList = () => {
    if (activePending) {
      return (
        <View className="items-center py-8">
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }

    const challenges = activeData?.challenges || [];
    if (challenges.length === 0) {
      return (
        <View className="bg-card border border-border p-8 rounded-xl items-center">
          <Target size={48} color={colors.mutedForeground} />
          <Text className="text-muted-foreground text-center mt-4">
            {t('noActiveChallenges') || 'No active challenges'}
          </Text>
          <Pressable
            onPress={() => setTab('browse')}
            className="bg-accent px-4 py-2 rounded-lg mt-4"
          >
            <Text className="text-accent-foreground font-medium">
              {t('browseChallenges') || 'Browse Challenges'}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View className="gap-3">
        {challenges.map((uc) => (
          <ActiveChallengeCard
            key={uc.id}
            userChallenge={uc}
            onAbandon={() => handleAbandon(uc.id)}
            isDark={isDark}
          />
        ))}
      </View>
    );
  };

  const renderHistoryList = () => {
    if (historyPending) {
      return (
        <View className="items-center py-8">
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }

    const challenges = historyData?.challenges || [];
    if (challenges.length === 0) {
      return (
        <View className="bg-card border border-border p-8 rounded-xl items-center">
          <Clock size={48} color={colors.mutedForeground} />
          <Text className="text-muted-foreground text-center mt-4">
            {t('noChallengeHistory') || 'No challenge history yet'}
          </Text>
        </View>
      );
    }

    return (
      <View className="gap-3">
        {challenges.map((uc) => (
          <HistoryChallengeCard
            key={uc.id}
            userChallenge={uc}
            isDark={isDark}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2" hitSlop={12}>
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">
          {t('challenges') || 'Challenges'}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: bottomPadding,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Card */}
        {stats && (
          <View className="bg-card border border-border p-5 rounded-xl mb-6">
            <View className="flex-row items-center mb-4">
              <Award size={24} color={colors.accent} />
              <Text className="text-base font-semibold text-foreground ml-2">
                {t('yourProgress') || 'Your Progress'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text className="text-2xl font-bold text-accent">{stats.total_points}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {t('points') || 'Points'}
                </Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-2xl font-bold text-success">{stats.total_completed}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {t('completed') || 'Completed'}
                </Text>
              </View>
              <View className="items-center flex-1">
                <View className="flex-row items-center">
                  <Flame size={16} color={colors.warning} />
                  <Text className="text-2xl font-bold text-foreground ml-1">
                    {stats.current_streak}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {t('streak') || 'Streak'}
                </Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-2xl font-bold text-foreground">
                  {Math.round(stats.completion_rate)}%
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {t('winRate') || 'Win Rate'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab Selector */}
        <View className="flex-row gap-2 mb-4">
          {(['browse', 'active', 'history'] as const).map((tabKey) => (
            <Pressable
              key={tabKey}
              onPress={() => {
                haptics.selection();
                setTab(tabKey);
              }}
              className={`flex-1 p-3 rounded-lg border ${
                tab === tabKey
                  ? 'bg-foreground border-foreground'
                  : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-center text-sm font-medium ${
                  tab === tabKey ? 'text-background' : 'text-foreground'
                }`}
              >
                {tabKey === 'browse'
                  ? t('browse') || 'Browse'
                  : tabKey === 'active'
                  ? t('active') || 'Active'
                  : t('history') || 'History'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        {tab === 'browse' && renderBrowseList()}
        {tab === 'active' && renderActiveList()}
        {tab === 'history' && renderHistoryList()}
      </ScrollView>

      {/* Challenge Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowDetailsModal(false)}
        >
          <Pressable
            className="bg-card rounded-t-3xl p-6"
            onPress={(e) => e.stopPropagation()}
          >
            {selectedChallenge && (
              <>
                <View className="items-center mb-6">
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-3"
                    style={{ backgroundColor: `${DIFFICULTY_COLORS[selectedChallenge.difficulty]}20` }}
                  >
                    {getChallengeIcon(
                      selectedChallenge.icon,
                      DIFFICULTY_COLORS[selectedChallenge.difficulty],
                      32
                    )}
                  </View>
                  <Text className="text-xl font-bold text-foreground text-center">
                    {selectedChallenge.name}
                  </Text>
                  <View className="flex-row items-center mt-2 gap-2">
                    <View
                      className="px-2 py-1 rounded"
                      style={{ backgroundColor: `${DIFFICULTY_COLORS[selectedChallenge.difficulty]}30` }}
                    >
                      <Text
                        className="text-xs font-medium capitalize"
                        style={{ color: DIFFICULTY_COLORS[selectedChallenge.difficulty] }}
                      >
                        {selectedChallenge.difficulty}
                      </Text>
                    </View>
                    <View className="flex-row items-center bg-muted px-2 py-1 rounded">
                      <Clock size={12} color={colors.mutedForeground} />
                      <Text className="text-xs text-muted-foreground ml-1">
                        {selectedChallenge.duration_days} {t('days') || 'days'}
                      </Text>
                    </View>
                    <View className="flex-row items-center bg-accent/20 px-2 py-1 rounded">
                      <Star size={12} color={colors.accent} />
                      <Text className="text-xs text-accent ml-1">
                        {selectedChallenge.points_reward} {t('pts') || 'pts'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text className="text-muted-foreground text-center mb-6">
                  {selectedChallenge.description}
                </Text>

                {selectedChallenge.user_status === 'active' ? (
                  <View className="mb-4">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-muted-foreground text-sm">
                        {t('progress') || 'Progress'}
                      </Text>
                      <Text className="text-foreground font-medium">
                        {Math.round(selectedChallenge.user_progress || 0)}%
                      </Text>
                    </View>
                    <View className="h-3 bg-muted rounded-full overflow-hidden">
                      <View
                        className="h-full bg-accent"
                        style={{ width: `${selectedChallenge.user_progress || 0}%` }}
                      />
                    </View>
                  </View>
                ) : null}

                {selectedChallenge.user_status !== 'active' ? (
                  <Button
                    variant="accent"
                    size="lg"
                    onPress={handleJoin}
                    isLoading={joinMutation.isPending}
                    leftIcon={<Play size={20} color={colors.primaryForeground} />}
                  >
                    {t('startChallenge') || 'Start Challenge'}
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    size="lg"
                    onPress={() => {
                      setShowDetailsModal(false);
                      handleAbandon(selectedChallenge.id);
                    }}
                    leftIcon={<XCircle size={20} color="white" />}
                  >
                    {t('abandonChallenge') || 'Abandon Challenge'}
                  </Button>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// Challenge Card Component
function ChallengeCard({
  challenge,
  onPress,
  isDark,
}: {
  challenge: ChallengeWithUserStatus;
  onPress: () => void;
  isDark: boolean;
}) {
  const { t } = useLanguage();
  const colors = useColors();
  const DIFFICULTY_COLORS = useDifficultyColors();
  const isActive = challenge.user_status === 'active';

  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border p-4 rounded-xl"
    >
      <View className="flex-row items-center">
        <View
          className="w-12 h-12 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${DIFFICULTY_COLORS[challenge.difficulty]}20` }}
        >
          {getChallengeIcon(
            challenge.icon,
            DIFFICULTY_COLORS[challenge.difficulty],
            24
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-foreground font-semibold flex-1" numberOfLines={1}>
              {challenge.name}
            </Text>
            {challenge.is_featured && (
              <View className="bg-accent/20 px-2 py-0.5 rounded ml-2">
                <Text className="text-xs text-accent font-medium">{t('featured') || 'Featured'}</Text>
              </View>
            )}
          </View>
          <Text className="text-muted-foreground text-xs mt-0.5" numberOfLines={1}>
            {challenge.description}
          </Text>
          <View className="flex-row items-center mt-2 gap-3">
            <View
              className="px-2 py-0.5 rounded"
              style={{ backgroundColor: `${DIFFICULTY_COLORS[challenge.difficulty]}20` }}
            >
              <Text
                className="text-xs capitalize"
                style={{ color: DIFFICULTY_COLORS[challenge.difficulty] }}
              >
                {challenge.difficulty}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Clock size={12} color={colors.mutedForeground} />
              <Text className="text-xs text-muted-foreground ml-1">
                {challenge.duration_days}d
              </Text>
            </View>
            <View className="flex-row items-center">
              <Star size={12} color={colors.accent} />
              <Text className="text-xs text-accent ml-1">
                +{challenge.points_reward}
              </Text>
            </View>
          </View>
        </View>
        {isActive && (
          <View className="bg-success/20 p-2 rounded-full ml-2">
            <Play size={16} color={colors.success} />
          </View>
        )}
      </View>

      {/* Progress bar for active challenges */}
      {isActive && challenge.user_progress !== undefined && (
        <View className="mt-3">
          <View className="h-2 bg-muted rounded-full overflow-hidden">
            <View
              className="h-full bg-accent"
              style={{ width: `${challenge.user_progress}%` }}
            />
          </View>
          <Text className="text-xs text-muted-foreground mt-1 text-right">
            {Math.round(challenge.user_progress)}%
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// Active Challenge Card
function ActiveChallengeCard({
  userChallenge,
  onAbandon,
  isDark,
}: {
  userChallenge: UserChallenge;
  onAbandon: () => void;
  isDark: boolean;
}) {
  const colors = useColors();
  const DIFFICULTY_COLORS = useDifficultyColors();
  const challenge = userChallenge.challenge;
  if (!challenge) return null;

  const endsAt = new Date(userChallenge.ends_at);
  const now = new Date();
  // Validate date before calculation
  const daysLeft = isNaN(endsAt.getTime())
    ? 0
    : Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <View className="bg-card border border-border p-4 rounded-xl">
      <View className="flex-row items-center mb-3">
        <View
          className="w-12 h-12 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${DIFFICULTY_COLORS[challenge.difficulty]}20` }}
        >
          {getChallengeIcon(
            challenge.icon,
            DIFFICULTY_COLORS[challenge.difficulty],
            24
          )}
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-semibold">{challenge.name}</Text>
          <View className="flex-row items-center mt-1">
            <Clock size={12} color={colors.mutedForeground} />
            <Text className="text-muted-foreground text-xs ml-1">
              {daysLeft} days left
            </Text>
            {userChallenge.streak_days > 0 && (
              <>
                <Flame size={12} color={colors.warning} className="ml-3" />
                <Text className="text-xs text-warning ml-1">
                  {userChallenge.streak_days} day streak
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      <View className="mb-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-muted-foreground text-sm">Progress</Text>
          <Text className="text-foreground font-medium">
            {Math.round(userChallenge.progress)}%
          </Text>
        </View>
        <View className="h-3 bg-muted rounded-full overflow-hidden">
          <View
            className="h-full bg-accent"
            style={{ width: `${userChallenge.progress}%` }}
          />
        </View>
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center bg-accent/20 px-2 py-1 rounded">
          <Star size={12} color={colors.accent} />
          <Text className="text-xs text-accent ml-1">
            +{challenge.points_reward} pts on completion
          </Text>
        </View>
        <Pressable
          onPress={onAbandon}
          className="p-2"
          hitSlop={8}
        >
          <XCircle size={20} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

// History Challenge Card
function HistoryChallengeCard({
  userChallenge,
  isDark,
}: {
  userChallenge: UserChallenge;
  isDark: boolean;
}) {
  const colors = useColors();
  const DIFFICULTY_COLORS = useDifficultyColors();
  const challenge = userChallenge.challenge;
  if (!challenge) return null;

  const isCompleted = userChallenge.status === 'completed';
  const statusColor = isCompleted ? colors.success : colors.danger;
  const StatusIcon = isCompleted ? CheckCircle : XCircle;

  return (
    <View className="bg-card border border-border p-4 rounded-xl opacity-80">
      <View className="flex-row items-center">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${statusColor}20` }}
        >
          <StatusIcon size={20} color={statusColor} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-semibold">{challenge.name}</Text>
          <View className="flex-row items-center mt-1">
            <Text
              className="text-xs capitalize"
              style={{ color: statusColor }}
            >
              {userChallenge.status}
            </Text>
            {isCompleted && (
              <View className="flex-row items-center ml-3">
                <Star size={12} color={colors.accent} />
                <Text className="text-xs text-accent ml-1">
                  +{challenge.points_reward} pts
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text className="text-xs text-muted-foreground">
          {new Date(userChallenge.started_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
}
