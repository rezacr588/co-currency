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
import { useTheme } from '../../src/context/ThemeContext';
import { useTheme as useStyledTheme } from 'styled-components/native';
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
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
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
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
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
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }

    const challenges = browseData?.challenges || [];
    if (challenges.length === 0) {
      return (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 32, borderRadius: 12, alignItems: 'center' }}>
          <Trophy size={48} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 16 }}>
            {t('noChallenges') || 'No challenges available'}
          </Text>
        </View>
      );
    }

    return (
      <View style={{ gap: 12 }}>
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
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }

    const challenges = activeData?.challenges || [];
    if (challenges.length === 0) {
      return (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 32, borderRadius: 12, alignItems: 'center' }}>
          <Target size={48} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 16 }}>
            {t('noActiveChallenges') || 'No active challenges'}
          </Text>
          <Pressable
            onPress={() => setTab('browse')}
            style={{ backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginTop: 16 }}
          >
            <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium' }}>
              {t('browseChallenges') || 'Browse Challenges'}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ gap: 12 }}>
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
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }

    const challenges = historyData?.challenges || [];
    if (challenges.length === 0) {
      return (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 32, borderRadius: 12, alignItems: 'center' }}>
          <Clock size={48} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 16 }}>
            {t('noChallengeHistory') || 'No challenge history yet'}
          </Text>
        </View>
      );
    }

    return (
      <View style={{ gap: 12 }}>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [{ padding: 8 }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('back') || 'Go back'} accessibilityRole="button">
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
          {t('challenges') || 'Challenges'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: bottomPadding,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Card */}
        {stats && (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Award size={24} color={colors.accent} />
              <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginStart: 8 }}>
                {t('yourProgress') || 'Your Progress'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.accent }}>{stats.total_points}</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                  {t('points') || 'Points'}
                </Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.success }}>{stats.total_completed}</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                  {t('completed') || 'Completed'}
                </Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Flame size={16} color={colors.warning} />
                  <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginStart: 4 }}>
                    {stats.current_streak}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                  {t('streak') || 'Streak'}
                </Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                  {Math.round(stats.completion_rate)}%
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                  {t('winRate') || 'Win Rate'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab Selector */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {(['browse', 'active', 'history'] as const).map((tabKey) => (
            <Pressable
              key={tabKey}
              onPress={() => {
                haptics.selection();
                setTab(tabKey);
              }}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: tab === tabKey ? colors.foreground : colors.card,
                borderColor: tab === tabKey ? colors.foreground : colors.border,
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: 14,
                  fontFamily: 'Inter_500Medium',
                  color: tab === tabKey ? colors.background : colors.foreground,
                }}
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
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setShowDetailsModal(false)}
        >
          <Pressable
            style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedChallenge && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                  <View
                    style={{ width: 64, height: 64, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: `${DIFFICULTY_COLORS[selectedChallenge.difficulty]}20` }}
                  >
                    {getChallengeIcon(
                      selectedChallenge.icon,
                      DIFFICULTY_COLORS[selectedChallenge.difficulty],
                      32
                    )}
                  </View>
                  <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center' }}>
                    {selectedChallenge.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                    <View
                      style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: `${DIFFICULTY_COLORS[selectedChallenge.difficulty]}30` }}
                    >
                      <Text
                        style={{ fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'capitalize', color: DIFFICULTY_COLORS[selectedChallenge.difficulty] }}
                      >
                        {selectedChallenge.difficulty}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                      <Clock size={12} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginStart: 4 }}>
                        {selectedChallenge.duration_days} {t('days') || 'days'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                      <Star size={12} color={colors.accent} />
                      <Text style={{ fontSize: 12, color: colors.accent, marginStart: 4 }}>
                        {selectedChallenge.points_reward} {t('pts') || 'pts'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 24 }}>
                  {selectedChallenge.description}
                </Text>

                {selectedChallenge.user_status === 'active' ? (
                  <View style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                        {t('progress') || 'Progress'}
                      </Text>
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                        {Math.round(selectedChallenge.user_progress || 0)}%
                      </Text>
                    </View>
                    <View style={{ height: 12, backgroundColor: colors.muted, borderRadius: 9999, overflow: 'hidden' }}>
                      <View
                        style={{ height: '100%', backgroundColor: colors.accent, width: `${selectedChallenge.user_progress || 0}%` }}
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
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const DIFFICULTY_COLORS = useDifficultyColors();
  const isActive = challenge.user_status === 'active';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12 }, pressed && { opacity: 0.7 }]}
      accessibilityLabel={challenge.name}
      accessibilityRole="button"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{ width: 48, height: 48, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginEnd: 12, backgroundColor: `${DIFFICULTY_COLORS[challenge.difficulty]}20` }}
        >
          {getChallengeIcon(
            challenge.icon,
            DIFFICULTY_COLORS[challenge.difficulty],
            24
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 }} numberOfLines={1}>
              {challenge.name}
            </Text>
            {challenge.is_featured && (
              <View style={{ backgroundColor: colors.accent + '33', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginStart: 8 }}>
                <Text style={{ fontSize: 12, color: colors.accent, fontFamily: 'Inter_500Medium' }}>{t('featured') || 'Featured'}</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {challenge.description}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
            <View
              style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: `${DIFFICULTY_COLORS[challenge.difficulty]}20` }}
            >
              <Text
                style={{ fontSize: 12, textTransform: 'capitalize', color: DIFFICULTY_COLORS[challenge.difficulty] }}
              >
                {challenge.difficulty}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Clock size={12} color={colors.mutedForeground} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginStart: 4 }}>
                {challenge.duration_days}d
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Star size={12} color={colors.accent} />
              <Text style={{ fontSize: 12, color: colors.accent, marginStart: 4 }}>
                +{challenge.points_reward}
              </Text>
            </View>
          </View>
        </View>
        {isActive && (
          <View style={{ backgroundColor: colors.success + '33', padding: 8, borderRadius: 9999, marginStart: 8 }}>
            <Play size={16} color={colors.success} />
          </View>
        )}
      </View>

      {/* Progress bar for active challenges */}
      {isActive && challenge.user_progress !== undefined && (
        <View style={{ marginTop: 12 }}>
          <View style={{ height: 8, backgroundColor: colors.muted, borderRadius: 9999, overflow: 'hidden' }}>
            <View
              style={{ height: '100%', backgroundColor: colors.accent, width: `${challenge.user_progress}%` }}
            />
          </View>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4, textAlign: 'right' }}>
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
  const { t } = useLanguage();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
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
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View
          style={{ width: 48, height: 48, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginEnd: 12, backgroundColor: `${DIFFICULTY_COLORS[challenge.difficulty]}20` }}
        >
          {getChallengeIcon(
            challenge.icon,
            DIFFICULTY_COLORS[challenge.difficulty],
            24
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>{challenge.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Clock size={12} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginStart: 4 }}>
              {daysLeft} {t('daysLeft') || 'days left'}
            </Text>
            {userChallenge.streak_days > 0 && (
              <>
                <Flame size={12} color={colors.warning} style={{ marginStart: 12 }} />
                <Text style={{ fontSize: 12, color: colors.warning, marginStart: 4 }}>
                  {userChallenge.streak_days} {t('dayStreak') || 'day streak'}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      <View style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t('progress') || 'Progress'}</Text>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
            {Math.round(userChallenge.progress)}%
          </Text>
        </View>
        <View style={{ height: 12, backgroundColor: colors.muted, borderRadius: 9999, overflow: 'hidden' }}>
          <View
            style={{ height: '100%', backgroundColor: colors.accent, width: `${userChallenge.progress}%` }}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
          <Star size={12} color={colors.accent} />
          <Text style={{ fontSize: 12, color: colors.accent, marginStart: 4 }}>
            +{challenge.points_reward} {t('ptsOnCompletion') || 'pts on completion'}
          </Text>
        </View>
        <Pressable
          onPress={onAbandon}
          hitSlop={8}
          style={({ pressed }) => [{ padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
          accessibilityLabel={t('abandonChallenge') || 'Abandon challenge'}
          accessibilityRole="button"
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
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const DIFFICULTY_COLORS = useDifficultyColors();
  const challenge = userChallenge.challenge;
  if (!challenge) return null;

  const isCompleted = userChallenge.status === 'completed';
  const statusColor = isCompleted ? colors.success : colors.danger;
  const StatusIcon = isCompleted ? CheckCircle : XCircle;

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, opacity: 0.8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{ width: 40, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginEnd: 12, backgroundColor: `${statusColor}20` }}
        >
          <StatusIcon size={20} color={statusColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>{challenge.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Text
              style={{ fontSize: 12, textTransform: 'capitalize', color: statusColor }}
            >
              {userChallenge.status}
            </Text>
            {isCompleted && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginStart: 12 }}>
                <Star size={12} color={colors.accent} />
                <Text style={{ fontSize: 12, color: colors.accent, marginStart: 4 }}>
                  +{challenge.points_reward} pts
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
          {new Date(userChallenge.started_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
}
