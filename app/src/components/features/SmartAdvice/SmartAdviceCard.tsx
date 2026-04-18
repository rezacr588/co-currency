import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, X, RefreshCw, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';
import { getTodaysTip } from '../../../data/financialTips';

const DISMISSED_KEY = '@smart_advice_dismissed';

function useCategoryColors(): Record<string, string> {
  const theme = useTheme();
  return {
    spending: theme.colors.warning,
    saving: theme.colors.success,
    budgeting: theme.colors.info,
    investing: theme.colors.palette.purple,
    general: theme.colors.mutedForeground,
  };
}

export function SmartAdviceCard() {
  const { t, language } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const { data: advice, isPending, isError } = useQuery({
    queryKey: ['ai', 'advice', language, refreshCount],
    queryFn: () => api.ai.getAdvice(language, refreshCount > 0),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    retry: 1,
  });

  const categoryColors = useCategoryColors();

  // Check dismissal
  const checkDismissed = async () => {
    try {
      const storedDate = await AsyncStorage.getItem(DISMISSED_KEY);
      const today = new Date().toISOString().split('T')[0];
      if (storedDate === today) setDismissed(true);
    } catch {
      // ignore
    }
  };
  // Run check once
  useState(() => { checkDismissed(); });

  const handleDismiss = async () => {
    haptics.light();
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(DISMISSED_KEY, today).catch(() => { });
    setDismissed(true);
  };

  const handleRefresh = () => {
    haptics.light();
    setRefreshCount(c => c + 1);
  };

  const handleAskAI = () => {
    haptics.light();
    router.push('/(app)/(tabs)/wallet/chat');
  };

  if (dismissed) return null;

  // Fallback to static tip if AI fails
  const displayAdvice = advice || (isError ? (() => {
    const tip = getTodaysTip();
    return { title: tip.tip, detail: tip.detail || '', category: tip.category, is_ai: false };
  })() : null);

  if (isPending) {
    return (
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (!displayAdvice) return null;

  const catColor = categoryColors[displayAdvice.category] || categoryColors.general;

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{ width: 40, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginEnd: 12, backgroundColor: `${catColor}20` }}
          >
            <Sparkles size={20} color={catColor} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                {t('smartAdvice') || 'Smart Advice'}
              </Text>
              {displayAdvice.is_ai && (
                <View style={{ marginStart: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: `${colors.accent}20` }}>
                  <Text style={{ color: colors.accent, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>AI</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 9999, marginEnd: 8, backgroundColor: catColor }} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textTransform: 'capitalize' }}>{displayAdvice.category}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={handleRefresh} hitSlop={10} style={{ cursor: 'pointer', padding: 8 }}>
            <RefreshCw size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable onPress={handleDismiss} hitSlop={10} style={{ cursor: 'pointer', padding: 8 }}>
            <X size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <View style={{ backgroundColor: colors.muted + '80', padding: 16, borderRadius: 8 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 16, marginBottom: 4 }}>{displayAdvice.title}</Text>
        {displayAdvice.detail ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>{displayAdvice.detail}</Text>
        ) : null}
      </View>

      {/* Ask AI Button */}
      <Pressable
        onPress={handleAskAI}
        style={({ pressed }) => [{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 8, borderRadius: 8 }, pressed && { opacity: 0.7 }]}
      >
        <MessageCircle size={14} color={colors.accent} />
        <Text style={{ color: colors.accent, fontSize: 13, fontFamily: 'Inter_600SemiBold', marginStart: 6 }}>
          {t('askForMore') || 'Ask AI for more'}
        </Text>
      </Pressable>
    </View>
  );
}
