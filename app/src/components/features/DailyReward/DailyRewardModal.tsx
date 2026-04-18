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
import { useTheme } from 'styled-components/native';
import { useToast } from '../../ui/Toast';
import { haptics } from '../../../utils/haptics';

const LAST_REWARD_KEY = '@last_daily_reward_date';

interface DailyRewardModalProps {
  onClose?: () => void;
}

export function DailyRewardModal({ onClose }: DailyRewardModalProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { showToast } = useToast();
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
      showToast(t('failedToClaimReward') || 'Failed to claim reward. Please try again.', 'error');
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
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onPress={handleClose}
      >
        <Pressable
          style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, width: '100%', maxWidth: 384 }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <Pressable
            onPress={handleClose}
            style={{ position: 'absolute', top: 16, right: 16, padding: 8, zIndex: 10, cursor: 'pointer' }}
            hitSlop={10}
          >
            <X size={20} color={colors.mutedForeground} />
          </Pressable>

          {/* Content */}
          <View style={{ alignItems: 'center' }}>
            {/* Icon */}
            <Animated.View
              style={[
                showAnimation && {
                  transform: [{ scale: scaleAnim }, { rotate: spin }],
                },
              ]}
            >
              <View style={{ width: 80, height: 80, borderRadius: 9999, backgroundColor: colors.accent + '33', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                {showAnimation ? (
                  <Sparkles size={40} color={colors.accent} />
                ) : (
                  <Gift size={40} color={colors.accent} />
                )}
              </View>
            </Animated.View>

            {/* Title */}
            <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 8 }}>
              {claimed
                ? t('rewardClaimed') || 'Reward Claimed!'
                : t('dailyReward') || 'Daily Reward'}
            </Text>

            {/* Streak info */}
            {isLoadingStatus ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
            ) : status ? (
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Star size={16} color={colors.warning} fill={colors.warning} />
                  <Text style={{ color: colors.mutedForeground, marginStart: 4 }}>
                    {status.consecutive_days} {t('dayStreak') || 'day streak'}
                  </Text>
                </View>

                {claimed && claimMutation.data ? (
                  <View style={{ backgroundColor: colors.accent + '33', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
                    <Text style={{ color: colors.accent, fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' }}>
                      +{claimMutation.data.reward.xp_awarded} XP
                    </Text>
                    {claimMutation.data.leveled_up && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                        <ChevronUp size={16} color={colors.success} />
                        <Text style={{ color: colors.success, fontFamily: 'Inter_500Medium', marginStart: 4 }}>
                          {t('levelUp') || 'Level Up!'} {claimMutation.data.new_level}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.muted, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
                    <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'center' }}>
                      +{status.next_reward_xp} XP
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: 'center' }}>
                      {t('availableToday') || 'Available today'}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* Weekly streak preview */}
            <View style={{ flexDirection: 'row', marginBottom: 24 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const consecutiveDays = status?.consecutive_days || 0;
                const isCompleted = day <= consecutiveDays;
                const isCurrent = day === consecutiveDays + 1;

                return (
                  <View
                    key={day}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginHorizontal: 4,
                      backgroundColor: isCompleted
                        ? colors.accent
                        : isCurrent
                        ? colors.accent + '4d'
                        : colors.muted,
                      borderWidth: isCurrent ? 2 : 0,
                      borderColor: isCurrent ? colors.accent : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Inter_700Bold',
                        color: isCompleted ? colors.accentForeground : colors.mutedForeground,
                      }}
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
                style={{
                  cursor: 'pointer',
                  width: '100%',
                  backgroundColor: colors.accent,
                  padding: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: claimMutation.isPending || status?.claimed_today ? 0.5 : 1,
                }}
              >
                {claimMutation.isPending ? (
                  <ActivityIndicator color={colors.accentForeground} />
                ) : (
                  <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>
                    {status?.claimed_today
                      ? t('alreadyClaimed') || 'Already Claimed Today'
                      : t('claimReward') || 'Claim Reward'}
                  </Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={handleClose}
                style={{ cursor: 'pointer', width: '100%', backgroundColor: colors.muted, padding: 16, borderRadius: 12, alignItems: 'center' }}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
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
