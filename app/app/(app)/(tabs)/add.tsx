import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Check, Search, Plus, Trash2 } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useColors } from '../../../src/context/ThemeContext';
import { formatCompactCurrency, getCurrencyDisplay } from '../../../src/utils/format';
import { CATEGORY_ICONS, CategoryIcon } from '../../../src/constants/icons';
import { COMMON_CURRENCIES } from '../../../src/constants/currencies';
import { useToast } from '../../../src/components/ui/Toast';
import { Toggle } from '../../../src/components/ui/Toggle';
import { FormError } from '../../../src/components/ui/FormError';
import { Button } from '../../../src/components/ui/Button';
import type { Category, TransactionRequest } from '../../../src/types/wallet';

const FALLBACK_CATEGORIES = Object.keys(CATEGORY_ICONS);
const CURRENCIES = [...COMMON_CURRENCIES];

export default function AddTransactionScreen() {
  const { t } = useLanguage();
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  // Calculate category card widths
  const containerPadding = isDesktop ? 32 : 16;
  const categoryGap = 8;
  const availableWidth = width - containerPadding * 2;
  const categoryCols = isDesktop ? 6 : isTablet ? 4 : 2;
  const categoryCardWidth = (availableWidth - categoryGap * (categoryCols - 1)) / categoryCols;
  const [showAllCategories, setShowAllCategories] = useState(false);
  const CATEGORY_PREVIEW_COUNT = isDesktop ? 18 : 8;

  const [type, setType] = useState<'credit' | 'debit'>('debit');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [enableTargetConversion, setEnableTargetConversion] = useState(false);
  const [walletCurrency, setWalletCurrency] = useState('EUR');
  const [category, setCategory] = useState('other');
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const { showToast } = useToast();
  const parsedAmount = Number.parseFloat(amount);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const { data: balancesData } = useQuery({
    queryKey: ['wallet', 'balances'],
    queryFn: () => api.wallet.getBalances(),
    staleTime: 60 * 1000,
  });

  const knownWalletCurrencies = useMemo(
    () => Array.from(new Set((balancesData?.balances || []).map((balance) => balance.currency))),
    [balancesData]
  );

  const availableWalletCurrencies = useMemo(() => {
    const merged = Array.from(new Set([...knownWalletCurrencies, ...CURRENCIES]));
    return merged;
  }, [knownWalletCurrencies]);

  useEffect(() => {
    if (availableWalletCurrencies.length === 0) return;
    if (!availableWalletCurrencies.includes(walletCurrency) || walletCurrency === currency) {
      const fallback = availableWalletCurrencies.find((code) => code !== currency) || currency;
      setWalletCurrency(fallback);
    }
  }, [availableWalletCurrencies, currency, walletCurrency]);

  const shouldFetchConversionPreview =
    enableTargetConversion && hasValidAmount && walletCurrency !== currency;

  const {
    data: conversionPreview,
    isPending: isLoadingConversionPreview,
    isError: isConversionPreviewError,
  } = useQuery({
    queryKey: ['wallet', 'add-transaction', 'conversion-preview', currency, walletCurrency, parsedAmount],
    queryFn: () =>
      api.convert({
        from: currency,
        to: walletCurrency,
        amount: parsedAmount,
      }),
    enabled: shouldFetchConversionPreview,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const {
    data: categoriesData,
    isPending: isLoadingCategories,
  } = useQuery({
    queryKey: ['wallet', 'categories'],
    queryFn: () => api.wallet.getCategories(),
    staleTime: 2 * 60 * 1000,
  });

  const categoryOptions = useMemo<Category[]>(() => {
    const remote = categoriesData?.categories;
    if (remote && remote.length > 0) {
      return remote;
    }
    return FALLBACK_CATEGORIES.map((name) => ({
      name,
      is_default: true,
    }));
  }, [categoriesData]);

  useEffect(() => {
    if (categoryOptions.length === 0) return;
    const hasSelected = categoryOptions.some((item) => item.name === category);
    if (!hasSelected) {
      setCategory(categoryOptions[0]?.name || 'other');
    }
  }, [category, categoryOptions]);

  const filteredCategoryOptions = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    if (!term) return categoryOptions;
    return categoryOptions.filter((item) =>
      item.name.toLowerCase().includes(term)
    );
  }, [categoryOptions, categorySearch]);

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => {
      const normalized = name.trim();
      const key = normalized.toLowerCase().replace(/\s+/g, '_');
      const icon = CATEGORY_ICONS[key] ? key : 'other';
      return api.wallet.createCategory({
        name: normalized,
        icon,
      });
    },
    onSuccess: (createdCategory) => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'categories'] });
      setCategory(createdCategory.name);
      setCategorySearch('');
      setNewCategoryName('');
      showToast(t('categoryAdded') || 'Category added', 'success');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('categoryCreateFailed') || 'Failed to create category', 'error');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryID: string) => api.wallet.deleteCategory(categoryID),
    onSuccess: (_result, deletedCategoryID) => {
      const deleted = categoryOptions.find((item) => item.id === deletedCategoryID);
      if (deleted && deleted.name === category) {
        setCategory('other');
      }
      queryClient.invalidateQueries({ queryKey: ['wallet', 'categories'] });
      showToast(t('categoryDeleted') || 'Category deleted', 'success');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('categoryDeleteFailed') || 'Failed to delete category', 'error');
    },
  });

  const mutation = useMutation({
    mutationFn: (data: TransactionRequest) => api.wallet.addTransaction(data),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      // Check for new badges in background (non-blocking)
      api.badges.check().then(() => {
        queryClient.invalidateQueries({ queryKey: ['badges'] });
      }).catch(() => {
        // Silently ignore badge check errors
      });
      showToast(t('transactionAdded') || 'Transaction added', 'success');
      router.back();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    },
  });

  const handleSubmit = () => {
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('enterValidAmount'));
      return;
    }

    const payload: TransactionRequest = {
      type,
      amount: parsedAmount,
      currency,
      category,
      description: description || undefined,
    };

    if (enableTargetConversion && walletCurrency && walletCurrency !== currency) {
      payload.wallet_currency = walletCurrency;
    }

    setError('');
    mutation.mutate(payload);
  };

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      setError(t('categoryRequired') || 'Category name is required');
      return;
    }
    setError('');
    createCategoryMutation.mutate(name);
  };

  const handleDeleteCategory = (item: Category) => {
    if (!item.id || item.is_default) return;
    Alert.alert(
      t('deleteCategory') || 'Delete category',
      t('confirmDeleteCategory') || 'Are you sure you want to delete this category?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: () => deleteCategoryMutation.mutate(item.id!),
        },
      ]
    );
  };

  const currencyDisplay = getCurrencyDisplay(currency);

  const resolveCategoryLabel = (name: string) => {
    const translationKey = name.toLowerCase().replace(/\s+/g, '_');
    const translated = t(translationKey);
    return translated === translationKey ? name : translated;
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 12) : 0}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: isDesktop ? 32 : 16,
            maxWidth: isDesktop ? 800 : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: '100%',
            paddingBottom: bottomPadding,
          }}
        >
          <Text
            className="font-semibold text-foreground mb-6"
            style={{ fontSize: isDesktop ? 24 : 22 }}
          >
            {t('addTransaction') || 'Add Transaction'}
          </Text>

          <FormError message={error} />

          {/* Desktop: Two column layout for type and amount */}
          <View
            style={{
              flexDirection: isDesktop ? 'row' : 'column',
              gap: isDesktop ? 24 : 0,
            }}
          >
            {/* Transaction Type */}
            <View className="mb-5" style={{ flex: isDesktop ? 1 : undefined }}>
              <Text className="text-muted-foreground text-sm mb-2">{t('transactionType') || 'Transaction Type'}</Text>
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
                    color={type === 'debit' ? colors.primaryForeground : colors.danger}
                  />
                  <Text
                    className={`font-medium ml-2 text-sm ${
                      type === 'debit' ? 'text-background' : 'text-foreground'
                    }`}
                  >
                    {t('expense') || 'Expense'}
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
                    color={type === 'credit' ? colors.primaryForeground : colors.success}
                  />
                  <Text
                    className={`font-medium ml-2 text-sm ${
                      type === 'credit' ? 'text-background' : 'text-foreground'
                    }`}
                  >
                    {t('income') || 'Income'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Amount */}
            <View className="mb-5" style={{ flex: isDesktop ? 1 : undefined }}>
              <Text className="text-muted-foreground text-sm mb-2">{t('amount') || 'Amount'}</Text>
              <View className="bg-muted border border-border rounded-lg flex-row items-center px-4">
                <Text className="text-xl text-muted-foreground mr-2">
                  {currencyDisplay.symbol}
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  selectionColor={colors.accent}
                  cursorColor={colors.accent}
                  style={{
                    flex: 1,
                    padding: 14,
                    fontSize: 20,
                    fontWeight: '600',
                    color: colors.foreground,
                    outlineStyle: 'none',
                  } as any}
                />
              </View>
            </View>
          </View>

          {/* Currency */}
          <View className="mb-5">
            <Text className="text-muted-foreground text-sm mb-2">{t('currency') || 'Currency'}</Text>
            {isDesktop ? (
              <View className="flex-row flex-wrap gap-2">
                {CURRENCIES.map((code) => {
                  const display = getCurrencyDisplay(code);
                  return (
                    <Pressable
                      key={code}
                      onPress={() => setCurrency(code)}
                      style={{ cursor: 'pointer', minHeight: 44 }}
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
                        style={{ cursor: 'pointer', minHeight: 44 }}
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

          {/* Optional wallet currency conversion */}
          <View className="mb-5 bg-card border border-border rounded-lg p-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1 pr-3">
                <Text className="text-foreground font-semibold text-sm">
                  {t('convertCurrency')}
                </Text>
                <Text className="text-muted-foreground text-xs mt-1">
                  {`${t('walletCurrency')} (${t('optional')})`}
                </Text>
              </View>
              <Toggle
                value={enableTargetConversion}
                onValueChange={setEnableTargetConversion}
              />
            </View>

            {enableTargetConversion ? (
              <>
                <Text className="text-muted-foreground text-xs mb-2">
                  {t('selectWalletCurrency')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {availableWalletCurrencies.map((code) => {
                      const display = getCurrencyDisplay(code);
                      const isSelected = walletCurrency === code;
                      const isSameAsTransactionCurrency = code === currency;
                      return (
                        <Pressable
                          key={code}
                          onPress={() => setWalletCurrency(code)}
                          style={{ cursor: 'pointer', minHeight: 44 }}
                          className={`px-3 py-2 rounded-md flex-row items-center border ${
                            isSelected
                              ? 'bg-foreground border-foreground'
                              : isSameAsTransactionCurrency
                                ? 'bg-secondary/70 border-border opacity-60'
                                : 'bg-secondary border-border'
                          }`}
                        >
                          <Text className="mr-1 text-sm">{display.flag || '🌐'}</Text>
                          <Text
                            className={`text-sm ${
                              isSelected
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

                {walletCurrency === currency ? (
                  <Text className="text-muted-foreground text-xs mt-3">
                    {t('selectWalletCurrency')}
                  </Text>
                ) : null}

                {shouldFetchConversionPreview ? (
                  <View className="mt-3 bg-secondary/40 border border-border rounded-lg p-3">
                    <Text className="text-foreground text-sm font-semibold mb-2">
                      {t('conversionPreview')}
                    </Text>
                    {isLoadingConversionPreview ? (
                      <View className="flex-row items-center">
                        <ActivityIndicator size="small" color={colors.accent} />
                        <Text className="text-muted-foreground text-xs ml-2">{t('converting')}</Text>
                      </View>
                    ) : isConversionPreviewError ? (
                      <Text className="text-danger text-xs">{t('conversionFailed')}</Text>
                    ) : conversionPreview ? (
                      <View>
                        <Text className="text-muted-foreground text-xs">
                          {`${formatCompactCurrency(parsedAmount, currency)} -> ${formatCompactCurrency(conversionPreview.result, walletCurrency)}`}
                        </Text>
                        <Text className="text-muted-foreground text-xs mt-1">
                          {`${t('rate')}: 1 ${currency} = ${conversionPreview.rate.toFixed(4)} ${walletCurrency}`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>

          {/* Category - Search + Manage */}
          <View className="mb-5 bg-card border border-border rounded-lg p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-muted-foreground text-sm">{t('category')}</Text>
              {isLoadingCategories ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : null}
            </View>

            <View className="bg-secondary border border-border rounded-lg px-3 flex-row items-center mb-3">
              <Search size={15} color={colors.secondaryForeground} />
              <TextInput
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder={t('searchCategories') || 'Search categories'}
                placeholderTextColor={colors.mutedForeground}
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  color: colors.foreground,
                  fontSize: 14,
                  outlineStyle: 'none',
                } as any}
              />
            </View>

            <View className="flex-row gap-2 mb-4">
              <View className="flex-1 bg-secondary border border-border rounded-lg px-3">
                <TextInput
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder={t('newCategoryName') || 'New category name'}
                  placeholderTextColor={colors.mutedForeground}
                  selectionColor={colors.accent}
                  cursorColor={colors.accent}
                  style={{
                    paddingVertical: 10,
                    color: colors.foreground,
                    fontSize: 14,
                    outlineStyle: 'none',
                  } as any}
                />
              </View>
              <Pressable
                onPress={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
                style={{ cursor: 'pointer', minHeight: 44 }}
                className={`px-3 rounded-lg flex-row items-center justify-center ${
                  createCategoryMutation.isPending ? 'bg-secondary opacity-60' : 'bg-accent'
                }`}
              >
                {createCategoryMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Plus size={14} color={colors.primaryForeground} />
                    <Text className="text-accent-foreground font-semibold ml-1 text-xs">
                      {t('addCategory') || 'Add'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {filteredCategoryOptions.length === 0 ? (
              <View className="bg-secondary/30 border border-border/60 rounded-lg p-3">
                <Text className="text-muted-foreground text-xs">
                  {t('noCategoriesFound') || 'No categories found'}
                </Text>
              </View>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  {(showAllCategories || categorySearch.trim()
                    ? filteredCategoryOptions
                    : filteredCategoryOptions.slice(0, CATEGORY_PREVIEW_COUNT)
                  ).map((item) => {
                    const isSelected = category === item.name;
                    const canDelete = !item.is_default && !!item.id;

                    return (
                      <Pressable
                        key={`${item.id || 'default'}-${item.name}`}
                        onPress={() => setCategory(item.name)}
                        style={{
                          cursor: 'pointer',
                          width: categoryCardWidth,
                          minHeight: 44,
                        }}
                        className={`relative px-2 py-2.5 rounded-md items-center justify-center border ${
                          isSelected ? 'bg-foreground border-foreground' : 'bg-secondary border-border'
                        }`}
                      >
                        <CategoryIcon
                          category={item.name}
                          size={16}
                          color={isSelected ? colors.primaryForeground : colors.secondaryForeground}
                        />
                        <Text
                          className={`text-xs mt-1 ${isSelected ? 'text-background font-medium' : 'text-foreground'}`}
                          numberOfLines={1}
                        >
                          {resolveCategoryLabel(item.name)}
                        </Text>

                        {canDelete ? (
                          <Pressable
                            onPress={(event) => {
                              event.stopPropagation();
                              handleDeleteCategory(item);
                            }}
                            style={{ cursor: 'pointer' }}
                            className="absolute top-1 right-1 p-1"
                            hitSlop={8}
                          >
                            <Trash2 size={10} color={isSelected ? colors.primaryForeground : colors.danger} />
                          </Pressable>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
                {!categorySearch.trim() && filteredCategoryOptions.length > CATEGORY_PREVIEW_COUNT && (
                  <Pressable
                    onPress={() => setShowAllCategories(!showAllCategories)}
                    style={{ cursor: 'pointer', minHeight: 44, justifyContent: 'center' }}
                    className="items-center mt-2"
                  >
                    <Text className="text-accent text-sm font-medium">
                      {showAllCategories
                        ? (t('showLess') || 'Show less')
                        : (t('showAllCategories') || `Show all (${filteredCategoryOptions.length})`)}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-muted-foreground text-sm mb-2">{t('description') || 'Description'}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('descriptionPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              multiline
              style={{
                backgroundColor: colors.secondary,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: 8,
                padding: 14,
                color: colors.foreground,
                fontSize: 16,
                minHeight: isDesktop ? 80 : 48,
                textAlignVertical: 'top',
                outlineStyle: 'none',
              } as any}
            />
          </View>

          {/* Submit Button */}
          <Button
            variant="accent"
            onPress={handleSubmit}
            isLoading={mutation.isPending}
            leftIcon={<Check size={18} color={colors.primaryForeground} />}
          >
            {t('saveTransaction') || 'Save Transaction'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
