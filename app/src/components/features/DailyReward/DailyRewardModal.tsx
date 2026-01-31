import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gift, Star, Sparkles, X, ChevronUp } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { haptics } from '../../../utils/haptics';

const LAST_REWARD_KEY = '@last_daily_reward_date';

interface DailyRewardModalProps {
  onClose?: () => void;
}

export function DailyRewardModal({ onClose }: DailyRewardModalProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Check if reward should be shown
  useEffect(() => {
    const checkReward = async () => {
      try {
        const lastDate = await AsyncStorage.getItem(LAST_REWARD_KEY);
        const today = new Date().toISOString().split('T')[0];

        if (lastDate !== today) {
          // Show modal after a short delay
          setTimeout(() => setVisible(true), 1500);
        }
      } catch (error) {
        // On error, don't show modal
      }
    };

    checkReward();
  }, []);

  // Get reward status
  const { data: status, isPending: isLoadingStatus } = useQuery({
    queryKey: ['xp', 'daily-reward', 'status'],
    queryFn: () => api.xp.getDailyRewardStatus(),
    enabled: visible,
  });

  // Claim reward mutation
  const claimMutation = useMutation({
    mutationFn: () => api.xp.claimDailyReward(),
    onSuccess: async (data) => {
      haptics.success();

      // Store today's date
      const today = new Date().toISOString().split('T')[0];
      await AsyncStorage.setItem(LAST_REWARD_KEY, today);

      // Show animation
      setShowAnimation(true);
      setClaimed(true);

      // Animate
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      // Invalidate XP queries
      queryClient.invalidateQueries({ queryKey: ['xp'] });
    },
    onError: () => {
      haptics.error();
    },
  });

  const handleClaim = () => {
    if (!claimed && !claimMutation.isPending) {
      haptics.medium();
      claimMutation.mutate();
    }
  };

  const handleClose = async () => {
    setVisible(false);
    // Mark as seen for today even if not claimed
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(LAST_REWARD_KEY, today);
    onClose?.();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        className="flex-1 bg-black/70 items-center justify-center p-6"
        onPress={handleClose}
      >
        <Pressable
          className="bg-card rounded-3xl p-6 w-full max-w-sm"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <Pressable
            onPress={handleClose}
            className="absolute top-4 right-4 p-2 z-10"
            hitSlop={10}
            style={{ cursor: 'pointer' }}
          >
            <X size={20} color="#71717a" />
          </Pressable>

          {/* Content */}
          <View className="items-center">
            {/* Icon */}
            <Animated.View
              style={[
                showAnimation && {
                  transform: [{ scale: scaleAnim }, { rotate: spin }],
                },
              ]}
            >
              <View className="w-20 h-20 rounded-full bg-accent/20 items-center justify-center mb-4">
                {showAnimation ? (
                  <Sparkles size={40} color="rgb(212, 175, 55)" />
                ) : (
                  <Gift size={40} color="rgb(212, 175, 55)" />
                )}
              </View>
            </Animated.View>

            {/* Title */}
            <Text className="text-xl font-bold text-foreground mb-2">
              {claimed
                ? t('rewardClaimed') || 'Reward Claimed!'
                : t('dailyReward') || 'Daily Reward'}
            </Text>

            {/* Streak info */}
            {isLoadingStatus ? (
              <ActivityIndicator color="rgb(212, 175, 55)" className="my-4" />
            ) : status ? (
              <View className="items-center mb-4">
                <View className="flex-row items-center mb-2">
                  <Star size={16} color="#f59e0b" fill="#f59e0b" />
                  <Text className="text-muted-foreground ml-1">
                    {status.consecutive_days} {t('dayStreak') || 'day streak'}
                  </Text>
                </View>

                {claimed && claimMutation.data ? (
                  <View className="bg-accent/20 px-6 py-3 rounded-xl">
                    <Text className="text-accent text-2xl font-bold text-center">
                      +{claimMutation.data.reward.xp_awarded} XP
                    </Text>
                    {claimMutation.data.leveled_up && (
                      <View className="flex-row items-center justify-center mt-2">
                        <ChevronUp size={16} color="#22c55e" />
                        <Text className="text-success font-medium ml-1">
                          {t('levelUp') || 'Level Up!'} {claimMutation.data.new_level}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View className="bg-muted px-6 py-3 rounded-xl">
                    <Text className="text-foreground text-lg font-semibold text-center">
                      +{status.next_reward_xp} XP
                    </Text>
                    <Text className="text-muted-foreground text-sm text-center">
                      {t('availableToday') || 'Available today'}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* Weekly streak preview */}
            <View className="flex-row mb-6">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const consecutiveDays = status?.consecutive_days || 0;
                const isCompleted = day <= consecutiveDays;
                const isCurrent = day === consecutiveDays + 1;

                return (
                  <View
                    key={day}
                    className={`w-8 h-8 rounded-full items-center justify-center mx-1 ${
                      isCompleted
                        ? 'bg-accent'
                        : isCurrent
                        ? 'bg-accent/30 border-2 border-accent'
                        : 'bg-muted'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isCompleted ? 'text-accent-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Claim button */}
            {!claimed ? (
              <Pressable
                onPress={handleClaim}
                disabled={claimMutation.isPending || status?.claimed_today}
                style={{ cursor: 'pointer' }}
                className={`w-full bg-accent p-4 rounded-xl items-center ${
                  claimMutation.isPending || status?.claimed_today ? 'opacity-50' : ''
                }`}
              >
                {claimMutation.isPending ? (
                  <ActivityIndicator color="#09090b" />
                ) : (
                  <Text className="text-accent-foreground font-bold text-lg">
                    {status?.claimed_today
                      ? t('alreadyClaimed') || 'Already Claimed Today'
                      : t('claimReward') || 'Claim Reward'}
                  </Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={handleClose}
                style={{ cursor: 'pointer' }}
                className="w-full bg-muted p-4 rounded-xl items-center"
              >
                <Text className="text-foreground font-medium">
                  {t('continue') || 'Continue'}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
