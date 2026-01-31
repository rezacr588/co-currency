import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lightbulb, X, RefreshCw } from 'lucide-react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { getTodaysTip, getRandomTip, type FinancialTip } from '../../../data/financialTips';
import { haptics } from '../../../utils/haptics';

const DISMISSED_KEY = '@daily_tip_dismissed';

interface DailyTipCardProps {
  compact?: boolean;
  showDismiss?: boolean;
  onDismiss?: () => void;
}

export function DailyTipCard({ compact = false, showDismiss = true, onDismiss }: DailyTipCardProps) {
  const { t } = useLanguage();
  const [tip, setTip] = useState<FinancialTip | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if today's tip was already dismissed
  useEffect(() => {
    const checkDismissed = async () => {
      try {
        const storedDate = await AsyncStorage.getItem(DISMISSED_KEY);
        const today = new Date().toISOString().split('T')[0];

        if (storedDate === today) {
          setDismissed(true);
        } else {
          // Clear old dismissal and show today's tip
          await AsyncStorage.removeItem(DISMISSED_KEY);
          setTip(getTodaysTip());
        }
      } catch (error) {
        // On error, just show the tip
        setTip(getTodaysTip());
      } finally {
        setIsLoading(false);
      }
    };

    checkDismissed();
  }, []);

  const handleDismiss = async () => {
    haptics.light();
    try {
      const today = new Date().toISOString().split('T')[0];
      await AsyncStorage.setItem(DISMISSED_KEY, today);
      setDismissed(true);
      onDismiss?.();
    } catch (error) {
      // Ignore storage errors
    }
  };

  const handleRefresh = () => {
    haptics.light();
    setTip(getRandomTip());
  };

  if (isLoading || dismissed || !tip) {
    return null;
  }

  const categoryColors: Record<FinancialTip['category'], string> = {
    savings: '#22c55e',
    budgeting: '#3b82f6',
    investing: '#8b5cf6',
    spending: '#f59e0b',
    general: '#71717a',
    debt: '#ef4444',
  };

  const categoryColor = categoryColors[tip.category];

  if (compact) {
    return (
      <View className="bg-card border border-border p-4 rounded-xl">
        <View className="flex-row items-center">
          <View
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: `${categoryColor}20` }}
          >
            <Lightbulb size={20} color={categoryColor} />
          </View>
          <View className="flex-1">
            <Text className="text-foreground font-medium text-sm" numberOfLines={2}>
              {tip.tip}
            </Text>
          </View>
          {showDismiss && (
            <Pressable
              onPress={handleDismiss}
              hitSlop={10}
              style={{ cursor: 'pointer' }}
              className="p-1"
            >
              <X size={16} color="#71717a" />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View className="bg-card border border-border p-5 rounded-xl">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: `${categoryColor}20` }}
          >
            <Lightbulb size={20} color={categoryColor} />
          </View>
          <View>
            <Text className="text-base font-semibold text-foreground">
              {t('dailyTip') || 'Daily Tip'}
            </Text>
            <View className="flex-row items-center">
              <View
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: categoryColor }}
              />
              <Text className="text-xs text-muted-foreground capitalize">
                {tip.category}
              </Text>
            </View>
          </View>
        </View>
        <View className="flex-row items-center">
          <Pressable
            onPress={handleRefresh}
            hitSlop={10}
            style={{ cursor: 'pointer' }}
            className="p-2"
          >
            <RefreshCw size={16} color="#71717a" />
          </Pressable>
          {showDismiss && (
            <Pressable
              onPress={handleDismiss}
              hitSlop={10}
              style={{ cursor: 'pointer' }}
              className="p-2"
            >
              <X size={16} color="#71717a" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tip Content */}
      <View className="bg-muted/50 p-4 rounded-lg">
        <Text className="text-foreground font-medium text-base mb-1">
          {tip.tip}
        </Text>
        {tip.detail && (
          <Text className="text-muted-foreground text-sm leading-relaxed">
            {tip.detail}
          </Text>
        )}
      </View>
    </View>
  );
}
