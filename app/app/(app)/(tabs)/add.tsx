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
import { CATEGORY_ICONS, CategoryIcon } from '../../../src/constants/icons';
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
            className="font-semibold text-foreground mb-6"
            style={{ fontSize: isDesktop ? 24 : 22 }}
          >
            {t('addTransaction')}
          </Text>

          {error ? (
            <View className="bg-danger-muted border border-danger/20 p-3 rounded-lg mb-4">
              <Text className="text-danger text-sm">{error}</Text>
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
            <View className="mb-5" style={{ flex: isDesktop ? 1 : undefined }}>
              <Text className="text-muted-foreground text-sm mb-2">{t('transactionType')}</Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setType('debit')}
                  style={{ cursor: 'pointer' }}
                  className={`flex-1 p-3.5 rounded-lg flex-row items-center justify-center border ${
                    type === 'debit' ? 'bg-foreground border-foreground' : 'bg-card border-border'
                  }`}
                >
                  <TrendingDown
                    size={18}
                    color={type === 'debit' ? '#09090b' : '#ef4444'}
                  />
                  <Text
                    className={`font-medium ml-2 text-sm ${
                      type === 'debit' ? 'text-background' : 'text-foreground'
                    }`}
                  >
                    {t('expense')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setType('credit')}
                  style={{ cursor: 'pointer' }}
                  className={`flex-1 p-3.5 rounded-lg flex-row items-center justify-center border ${
                    type === 'credit' ? 'bg-foreground border-foreground' : 'bg-card border-border'
                  }`}
                >
                  <TrendingUp
                    size={18}
                    color={type === 'credit' ? '#09090b' : '#22c55e'}
                  />
                  <Text
                    className={`font-medium ml-2 text-sm ${
                      type === 'credit' ? 'text-background' : 'text-foreground'
                    }`}
                  >
                    {t('income')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Amount */}
            <View className="mb-5" style={{ flex: isDesktop ? 1 : undefined }}>
              <Text className="text-muted-foreground text-sm mb-2">{t('amount')}</Text>
              <View className="bg-muted border border-border rounded-lg flex-row items-center px-4">
                <Text className="text-xl text-muted-foreground mr-2">
                  {currencyDisplay.symbol}
                </Text>
                <TextInput
                  className="flex-1 p-3.5 text-xl font-semibold text-foreground"
                  style={{ outlineStyle: 'none' } as any}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#52525b"
                />
              </View>
            </View>
          </View>

          {/* Currency */}
          <View className="mb-5">
            <Text className="text-muted-foreground text-sm mb-2">{t('currency')}</Text>
            {isDesktop ? (
              <View className="flex-row flex-wrap gap-2">
                {CURRENCIES.map((code) => {
                  const display = getCurrencyDisplay(code);
                  return (
                    <Pressable
                      key={code}
                      onPress={() => setCurrency(code)}
                      style={{ cursor: 'pointer' }}
                      className={`px-3 py-2 rounded-md flex-row items-center border ${
                        currency === code ? 'bg-foreground border-foreground' : 'bg-secondary border-border'
                      }`}
                    >
                      <Text className="mr-1 text-sm">{display.flag || '🌐'}</Text>
                      <Text
                        className={`text-sm ${
                          currency === code
                            ? 'text-background font-medium'
                            : 'text-foreground'
                        }`}
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
                        className={`px-3 py-2 rounded-md flex-row items-center border ${
                          currency === code ? 'bg-foreground border-foreground' : 'bg-secondary border-border'
                        }`}
                      >
                        <Text className="mr-1 text-sm">{display.flag || '🌐'}</Text>
                        <Text
                          className={`text-sm ${
                            currency === code
                              ? 'text-background font-medium'
                              : 'text-foreground'
                          }`}
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

          {/* Category - Responsive Grid with Icons */}
          <View className="mb-5">
            <Text className="text-muted-foreground text-sm mb-2">{t('category')}</Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat;

                return (
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
                    className={`px-3 py-2.5 rounded-md flex-row items-center justify-center gap-2 border ${
                      isSelected ? 'bg-foreground border-foreground' : 'bg-secondary border-border'
                    }`}
                  >
                    <CategoryIcon
                      category={cat}
                      size={16}
                      color={isSelected ? '#09090b' : '#a1a1aa'}
                    />
                    <Text
                      className={`text-sm ${isSelected ? 'text-background font-medium' : 'text-foreground'}`}
                      numberOfLines={1}
                    >
                      {t(cat as any) || cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-muted-foreground text-sm mb-2">{t('description')}</Text>
            <TextInput
              className="bg-muted border border-border p-3.5 rounded-lg text-foreground"
              style={{ outlineStyle: 'none', minHeight: isDesktop ? 80 : undefined } as any}
              value={description}
              onChangeText={setDescription}
              placeholder={t('descriptionPlaceholder')}
              placeholderTextColor="#52525b"
              multiline
            />
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={mutation.isPending}
            style={{ cursor: 'pointer' }}
            className={`bg-accent p-3.5 rounded-lg flex-row items-center justify-center ${
              mutation.isPending ? 'opacity-50' : ''
            }`}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#09090b" />
            ) : (
              <>
                <Check size={18} color="#09090b" />
                <Text className="text-accent-foreground font-semibold ml-2">
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
