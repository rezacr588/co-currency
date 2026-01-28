import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot, Sparkles, Check } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useTheme } from '../../../../src/context/ThemeContext';
import { formatCurrency } from '../../../../src/utils/format';
import type { AIParseResponse } from '../../../../src/types/wallet';

export default function AIReceiptScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;
  const iconColor = isDark ? 'rgb(248, 250, 252)' : 'rgb(51, 65, 85)';

  const [text, setText] = useState('');
  const [parsedResult, setParsedResult] = useState<AIParseResponse | null>(null);
  const [error, setError] = useState('');

  const parseMutation = useMutation({
    mutationFn: () => api.ai.parseReceipt({ text }),
    onSuccess: (data) => {
      setParsedResult(data);
      setError('');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to parse text');
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!parsedResult) throw new Error('No parsed result');
      return api.ai.applyParsed({
        amount: parsedResult.amount,
        currency: parsedResult.currency,
        type: parsedResult.type,
        description: parsedResult.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      router.back();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to apply transaction');
    },
  });

  const handleParse = () => {
    if (!text.trim()) {
      setError(t('enterReceiptText'));
      return;
    }
    setError('');
    setParsedResult(null);
    parseMutation.mutate();
  };

  const handleApply = () => {
    applyMutation.mutate();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-border" style={{ maxWidth: 800, width: '100%', alignSelf: 'center' }}>
        <Pressable
          onPress={() => router.back()}
          className="p-2 mr-2"
          hitSlop={12}
          style={{ cursor: 'pointer' }}
        >
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Bot size={24} color="rgb(168, 85, 247)" />
        <Text className="text-xl font-bold text-foreground ml-2">{t('aiReceiptParser')}</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 24,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: bottomPadding,
        }}
      >
        <Text className="text-muted-foreground mb-4">{t('aiParserDescription')}</Text>

        {error ? (
          <View className="bg-danger-light p-4 rounded-xl mb-4">
            <Text className="text-danger">{error}</Text>
          </View>
        ) : null}

        {/* Text Input */}
        <View className="mb-6">
          <Text className="text-sm text-muted-foreground mb-2">{t('receiptText')}</Text>
          <TextInput
            className="bg-card p-4 rounded-xl text-foreground min-h-[150px]"
            style={{ outlineStyle: 'none' } as any}
            value={text}
            onChangeText={setText}
            placeholder={t('pasteReceiptText')}
            placeholderTextColor="rgb(148, 163, 184)"
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Parse Button */}
        <Pressable
          onPress={handleParse}
          disabled={parseMutation.isPending}
          className={`bg-purple-600 p-4 rounded-xl flex-row items-center justify-center mb-6 ${
            parseMutation.isPending ? 'opacity-50' : ''
          }`}
          style={{ cursor: 'pointer' }}
        >
          {parseMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Sparkles size={20} color="white" />
              <Text className="text-white font-semibold text-lg ml-2">{t('parseWithAI')}</Text>
            </>
          )}
        </Pressable>

        {/* Parsed Result */}
        {parsedResult && (
          <View className="bg-card p-6 rounded-xl mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">
              {t('parsedResult')}
            </Text>

            <View className="gap-3">
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground">{t('amount')}</Text>
                <Text className="text-foreground font-semibold">
                  {formatCurrency(parsedResult.amount, parsedResult.currency)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground">{t('type')}</Text>
                <Text
                  className={`font-semibold ${
                    parsedResult.type === 'credit' ? 'text-success' : 'text-danger'
                  }`}
                >
                  {parsedResult.type === 'credit' ? t('income') : t('expense')}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground">{t('description')}</Text>
                <Text className="text-foreground flex-1 text-right ml-4" numberOfLines={2}>
                  {parsedResult.description}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground">{t('confidence')}</Text>
                <Text className="text-accent font-semibold">
                  {(parsedResult.confidence * 100).toFixed(0)}%
                </Text>
              </View>
            </View>

            {/* Apply Button */}
            <Pressable
              onPress={handleApply}
              disabled={applyMutation.isPending}
              className={`bg-success p-4 rounded-xl flex-row items-center justify-center mt-6 ${
                applyMutation.isPending ? 'opacity-50' : ''
              }`}
              style={{ cursor: 'pointer' }}
            >
              {applyMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Check size={20} color="white" />
                  <Text className="text-white font-semibold text-lg ml-2">
                    {t('addToWallet')}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
