import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lightbulb, X, RefreshCw } from 'lucide-react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { getTodaysTip, getRandomTip, type FinancialTip } from '../../../data/financialTips';
import { haptics } from '../../../utils/haptics';
import { HIT_SLOP_SM } from '../../../constants/hitSlop';

const DISMISSED_KEY = '@daily_tip_dismissed';

interface DailyTipCardProps {
  compact?: boolean;
  showDismiss?: boolean;
  onDismiss?: () => void;
}

// Semantic + palette mapping for tip categories. Hook keeps theme-aware colors
// in sync with dark/light switches without module-level hex.
function useTipCategoryColors(): Record<FinancialTip['category'], string> {
  const theme = useTheme();
  return {
    savings: theme.colors.success,
    budgeting: theme.colors.info,
    investing: theme.colors.palette.purple,
    spending: theme.colors.warning,
    general: theme.colors.mutedForeground,
    debt: theme.colors.danger,
  };
}

export function DailyTipCard({ compact = false, showDismiss = true, onDismiss }: DailyTipCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
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
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{ width: 40, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginEnd: 12, backgroundColor: `${categoryColor}20` }}
          >
            <Lightbulb size={20} color={categoryColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }} numberOfLines={2}>
              {tip.tip}
            </Text>
          </View>
          {showDismiss && (
            <Pressable
              onPress={handleDismiss}
              hitSlop={10}
              style={{ cursor: 'pointer', padding: 4 }}
            >
              <X size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{ width: 40, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginEnd: 12, backgroundColor: `${categoryColor}20` }}
          >
            <Lightbulb size={20} color={categoryColor} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {t('dailyTip') || 'Daily Tip'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{ width: 8, height: 8, borderRadius: 9999, marginEnd: 8, backgroundColor: categoryColor }}
              />
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textTransform: 'capitalize' }}>
                {tip.category}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={handleRefresh}
            hitSlop={10}
            style={{ cursor: 'pointer', padding: 8 }}
          >
            <RefreshCw size={16} color={colors.mutedForeground} />
          </Pressable>
          {showDismiss && (
            <Pressable
              onPress={handleDismiss}
              hitSlop={10}
              style={{ cursor: 'pointer', padding: 8 }}
            >
              <X size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tip Content */}
      <View style={{ backgroundColor: colors.muted + '80', padding: 16, borderRadius: 8 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 16, marginBottom: 4 }}>
          {tip.tip}
        </Text>
        {tip.detail && (
          <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>
            {tip.detail}
          </Text>
        )}
      </View>
    </View>
  );
}
