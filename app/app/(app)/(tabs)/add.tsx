import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Check } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { getCurrencyDisplay } from '../../../src/utils/format';
import { CATEGORY_ICONS } from '../../../src/constants/icons';
import type { TransactionRequest } from '../../../src/types/wallet';

const CATEGORIES = Object.keys(CATEGORY_ICONS);
const CURRENCIES = ['USD', 'EUR', 'GBP', 'IRR', 'JPY', 'CHF', 'CAD', 'AUD'];

export default function AddTransactionScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  const [type, setType] = useState<'credit' | 'debit'>('debit');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: TransactionRequest) => api.wallet.addTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      router.back();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    },
  });

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('enterValidAmount'));
      return;
    }

    setError('');
    mutation.mutate({
      type,
      amount: parsedAmount,
      currency,
      category,
      description: description || undefined,
    });
  };

  const currencyDisplay = getCurrencyDisplay(currency);

  // Calculate category grid columns based on screen width
  const getCategoryColumns = () => {
    if (isDesktop) return 6;
    if (isTablet) return 4;
    return 3;
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: isDesktop ? 32 : 24,
            maxWidth: isDesktop ? 800 : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: '100%',
          }}
        >
          <Text
            className="font-bold text-foreground mb-6"
            style={{ fontSize: isDesktop ? 32 : 28 }}
          >
            {t('addTransaction')}
          </Text>

          {error ? (
            <View className="bg-danger-light p-4 rounded-xl mb-4">
              <Text className="text-danger">{error}</Text>
            </View>
          ) : null}

          {/* Desktop: Two column layout for type and amount */}
          <View
            style={{
              flexDirection: isDesktop ? 'row' : 'column',
              gap: isDesktop ? 24 : 0,
            }}
          >
            {/* Transaction Type */}
            <View className="mb-6" style={{ flex: isDesktop ? 1 : undefined }}>
              <Text className="text-muted-foreground mb-2">{t('transactionType')}</Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setType('debit')}
                  style={{ cursor: 'pointer' }}
                  className={`flex-1 p-4 rounded-xl flex-row items-center justify-center ${
                    type === 'debit' ? 'bg-danger' : 'bg-card'
                  }`}
                >
                  <TrendingDown
                    size={20}
                    color={type === 'debit' ? 'white' : 'rgb(220, 38, 38)'}
                  />
                  <Text
                    className={`font-semibold ml-2 ${
                      type === 'debit' ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {t('expense')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setType('credit')}
                  style={{ cursor: 'pointer' }}
                  className={`flex-1 p-4 rounded-xl flex-row items-center justify-center ${
                    type === 'credit' ? 'bg-success' : 'bg-card'
                  }`}
                >
                  <TrendingUp
                    size={20}
                    color={type === 'credit' ? 'white' : 'rgb(16, 185, 129)'}
                  />
                  <Text
                    className={`font-semibold ml-2 ${
                      type === 'credit' ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {t('income')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Amount */}
            <View className="mb-6" style={{ flex: isDesktop ? 1 : undefined }}>
              <Text className="text-muted-foreground mb-2">{t('amount')}</Text>
              <View className="bg-card rounded-xl flex-row items-center px-4">
                <Text className="text-2xl text-muted-foreground mr-2">
                  {currencyDisplay.symbol}
                </Text>
                <TextInput
                  className="flex-1 p-4 text-2xl font-bold text-foreground"
                  style={{ outlineStyle: 'none' } as any}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="rgb(148, 163, 184)"
                />
              </View>
            </View>
          </View>

          {/* Currency */}
          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('currency')}</Text>
            {isDesktop ? (
              <View className="flex-row flex-wrap gap-2">
                {CURRENCIES.map((code) => {
                  const display = getCurrencyDisplay(code);
                  return (
                    <Pressable
                      key={code}
                      onPress={() => setCurrency(code)}
                      style={{ cursor: 'pointer' }}
                      className={`px-4 py-2 rounded-lg flex-row items-center ${
                        currency === code ? 'bg-accent' : 'bg-card'
                      }`}
                    >
                      <Text className="mr-1">{display.flag || '🌐'}</Text>
                      <Text
                        className={
                          currency === code
                            ? 'text-accent-foreground font-semibold'
                            : 'text-foreground'
                        }
                      >
                        {code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {CURRENCIES.map((code) => {
                    const display = getCurrencyDisplay(code);
                    return (
                      <Pressable
                        key={code}
                        onPress={() => setCurrency(code)}
                        style={{ cursor: 'pointer' }}
                        className={`px-4 py-2 rounded-lg flex-row items-center ${
                          currency === code ? 'bg-accent' : 'bg-card'
                        }`}
                      >
                        <Text className="mr-1">{display.flag || '🌐'}</Text>
                        <Text
                          className={
                            currency === code
                              ? 'text-accent-foreground font-semibold'
                              : 'text-foreground'
                          }
                        >
                          {code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>

          {/* Category - Responsive Grid */}
          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('category')}</Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={{
                    cursor: 'pointer',
                    width: isDesktop
                      ? `${100 / getCategoryColumns() - 2}%`
                      : isTablet
                      ? `${100 / 4 - 2}%`
                      : undefined,
                    minWidth: isDesktop || isTablet ? undefined : 100,
                  }}
                  className={`px-4 py-3 rounded-lg ${
                    category === cat ? 'bg-accent' : 'bg-card'
                  }`}
                >
                  <Text
                    className={`text-center ${
                      category === cat
                        ? 'text-accent-foreground font-semibold'
                        : 'text-foreground'
                    }`}
                  >
                    {t(cat as any) || cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('description')}</Text>
            <TextInput
              className="bg-card p-4 rounded-xl text-foreground"
              style={{ outlineStyle: 'none', minHeight: isDesktop ? 100 : undefined } as any}
              value={description}
              onChangeText={setDescription}
              placeholder={t('descriptionPlaceholder')}
              placeholderTextColor="rgb(148, 163, 184)"
              multiline
            />
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={mutation.isPending}
            style={{ cursor: 'pointer' }}
            className={`bg-primary p-4 rounded-xl flex-row items-center justify-center ${
              mutation.isPending ? 'opacity-50' : ''
            }`}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Check size={20} color="white" />
                <Text className="text-white font-semibold text-lg ml-2">
                  {t('saveTransaction')}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
