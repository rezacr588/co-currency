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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Check, Search, Plus, Trash2, Sparkles } from 'lucide-react-native';
import styled, { useTheme } from 'styled-components/native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useAuth } from '../../../src/context/AuthContext';
import { formatCompactCurrency, getCurrencyDisplay } from '../../../src/utils/format';
import { CATEGORY_ICONS, CategoryIcon } from '../../../src/constants/icons';
import { COMMON_CURRENCIES } from '../../../src/constants/currencies';
import { useToast } from '../../../src/components/ui/Toast';
import { Toggle } from '../../../src/components/ui/Toggle';
import { FormError } from '../../../src/components/ui/FormError';
import { Button } from '../../../src/components/ui/Button';
import { H2, Caption, BodyMedium } from '../../../src/components/ui/styled';
import type { Category, TransactionRequest } from '../../../src/types/wallet';
import type { AddTransactionStep } from '../../../src/navigation/mode';
import { linkTaskToTransactionIfNeeded } from '../../../src/utils/taskLinking';
import { getAddTransactionSourceWalletState } from '../../../src/utils/addTransactionSourceWallet';
import { useScreenLayout } from '../../../src/hooks/useScreenLayout';

const ScreenContainer = styled(SafeAreaView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
`;

const SectionCard = styled.View`
  background-color: ${({ theme }) => theme.colors.card};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.borderSubtle};
  margin-bottom: ${({ theme }) => theme.spacing.xl}px;
`;

const TypeButton = styled.Pressable<{ $active: boolean }>`
  flex: 1;
  padding: 14px;
  border-radius: ${({ theme }) => theme.radii.md}px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  border-width: 1px;
  background-color: ${({ theme, $active }) => $active ? theme.colors.foreground : theme.colors.card};
  border-color: ${({ theme, $active }) => $active ? theme.colors.foreground : theme.colors.border};
`;

const AmountContainer = styled.View`
  background-color: ${({ theme }) => theme.colors.muted};
  border-radius: ${({ theme }) => theme.radii.md}px;
  flex-direction: row;
  align-items: center;
  padding-horizontal: ${({ theme }) => theme.spacing.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
`;

const CurrencyChip = styled.Pressable<{ $active: boolean }>`
  padding-horizontal: ${({ theme }) => theme.spacing.md}px;
  padding-vertical: ${({ theme }) => theme.spacing.sm}px;
  border-radius: ${({ theme }) => theme.radii.md}px;
  flex-direction: row;
  align-items: center;
  border-width: 1px;
  min-height: 44px;
  background-color: ${({ theme, $active }) => $active ? theme.colors.foreground : theme.colors.secondary};
  border-color: ${({ theme, $active }) => $active ? theme.colors.foreground : theme.colors.border};
`;

const SearchContainer = styled.View`
  background-color: ${({ theme }) => theme.colors.secondary};
  border-radius: ${({ theme }) => theme.radii.md}px;
  padding-horizontal: ${({ theme }) => theme.spacing.md}px;
  flex-direction: row;
  align-items: center;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  margin-bottom: ${({ theme }) => theme.spacing.md}px;
`;

const CategoryChip = styled.Pressable<{ $active: boolean }>`
  padding-horizontal: ${({ theme }) => theme.spacing.sm}px;
  padding-vertical: 10px;
  border-radius: ${({ theme }) => theme.radii.md}px;
  align-items: center;
  justify-content: center;
  border-width: 1px;
  min-height: 44px;
  background-color: ${({ theme, $active }) => $active ? theme.colors.foreground : theme.colors.secondary};
  border-color: ${({ theme, $active }) => $active ? theme.colors.foreground : theme.colors.border};
`;

const FALLBACK_CATEGORIES = Object.keys(CATEGORY_ICONS);
const CURRENCIES = [...COMMON_CURRENCIES];
const ADD_TRANSACTION_STEPS: AddTransactionStep[] = ['basics', 'currency', 'category', 'review'];
const STEP_LABEL_KEYS: Record<AddTransactionStep, { key: string; fallback: string }> = {
  basics: { key: 'stepBasics', fallback: 'Basics' },
  currency: { key: 'currency', fallback: 'Currency' },
  category: { key: 'category', fallback: 'Category' },
  review: { key: 'stepReview', fallback: 'Review' },
};
const STEP_LABEL_SHORT_KEYS: Record<AddTransactionStep, { key: string; fallback: string }> = {
  basics: { key: 'stepBasicsShort', fallback: 'Basics' },
  currency: { key: 'stepCurrencyShort', fallback: 'Currency' },
  category: { key: 'stepCategoryShort', fallback: 'Category' },
  review: { key: 'stepReviewShort', fallback: 'Review' },
};

export default function AddTransactionScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    type?: string;
    amount?: string;
    currency?: string;
    wallet_currency?: string;
    category?: string;
    description?: string;
    linked_task_id?: string;
    return_to?: string;
  }>();
  const queryClient = useQueryClient();
  const { width, isCompactPhone, isDesktop, isTablet } = useScreenLayout();
  const insets = useSafeAreaInsets();
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  const containerPadding = isDesktop ? 32 : 16;
  const categoryGap = 8;
  const availableWidth = width - containerPadding * 2;
  const categoryCols = isDesktop ? 6 : isTablet ? 4 : 2;
  const categoryCardWidth = (availableWidth - categoryGap * (categoryCols - 1)) / categoryCols;
  const [showAllCategories, setShowAllCategories] = useState(false);
  const CATEGORY_PREVIEW_COUNT = isDesktop ? 18 : 8;

  const [type, setType] = useState<'credit' | 'debit'>('debit');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [enableTargetConversion, setEnableTargetConversion] = useState(true);
  const [walletCurrency, setWalletCurrency] = useState('USD');
  const [category, setCategory] = useState('other');
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<AddTransactionStep>('basics');
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const { showToast } = useToast();
  const userID = user?.id || '';
  const parsedAmount = Number.parseFloat(amount);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const stepIndex = ADD_TRANSACTION_STEPS.indexOf(step);
  const returnTo = typeof params.return_to === 'string' && params.return_to.trim() ? decodeURIComponent(params.return_to) : '';
  const linkedTaskID = typeof params.linked_task_id === 'string' ? params.linked_task_id.trim() : '';

  useEffect(() => {
    if (typeof params.type === 'string' && (params.type === 'credit' || params.type === 'debit')) {
      setType(params.type);
    }
    if (typeof params.amount === 'string' && params.amount.trim()) {
      setAmount(params.amount);
    }
    if (typeof params.currency === 'string' && params.currency.trim()) {
      setCurrency(params.currency.toUpperCase());
    }
    if (typeof params.wallet_currency === 'string' && params.wallet_currency.trim()) {
      setWalletCurrency(params.wallet_currency.toUpperCase());
    }
    if (typeof params.category === 'string' && params.category.trim()) {
      setCategory(params.category);
    }
    if (typeof params.description === 'string' && params.description.trim()) {
      setDescription(params.description);
    }
  }, [
    params.amount,
    params.category,
    params.currency,
    params.description,
    params.type,
    params.wallet_currency,
  ]);

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
    if (!availableWalletCurrencies.includes(walletCurrency)) {
      const fallback = availableWalletCurrencies.includes('USD')
        ? 'USD'
        : availableWalletCurrencies[0] || currency;
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

  const sourceWalletState = useMemo(() => getAddTransactionSourceWalletState({
    type,
    amount: hasValidAmount ? parsedAmount : 0,
    currency,
    enableSourceWallet: enableTargetConversion,
    walletCurrency,
    conversionResult: conversionPreview?.result,
    balances: balancesData?.balances || [],
  }), [
    type,
    hasValidAmount,
    parsedAmount,
    currency,
    enableTargetConversion,
    walletCurrency,
    conversionPreview?.result,
    balancesData?.balances,
  ]);

  const sourceWalletImpactLabel = useMemo(() => {
    if (sourceWalletState.sourceWalletAmount === null) {
      if (sourceWalletState.isCrossCurrency && isConversionPreviewError) {
        return t('sourceWalletPreviewUnavailable') || 'Unable to calculate wallet impact right now.';
      }
      if (sourceWalletState.isCrossCurrency && isLoadingConversionPreview) {
        return t('sourceWalletPreviewPending') || 'Calculating wallet impact...';
      }
      return t('sourceWalletPreviewPending') || 'Calculating wallet impact...';
    }

    const signedAmount = `${type === 'debit' ? '-' : '+'}${formatCompactCurrency(
      sourceWalletState.sourceWalletAmount,
      sourceWalletState.sourceWalletCurrency
    )}`;
    return signedAmount;
  }, [
    sourceWalletState.sourceWalletAmount,
    sourceWalletState.sourceWalletCurrency,
    sourceWalletState.isCrossCurrency,
    isConversionPreviewError,
    isLoadingConversionPreview,
    t,
    type,
  ]);
  const isReviewBlockedBySourceBalance = type === 'debit' && sourceWalletState.hasInsufficientSourceBalance;
  const shouldWrapCoreChoiceChips = !isTablet && !isDesktop;

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.ai.getStatus(),
    staleTime: 5 * 60 * 1000,
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
    if (remote && remote.length > 0) return remote;
    return FALLBACK_CATEGORIES.map((name) => ({ name, is_default: true }));
  }, [categoriesData]);

  useEffect(() => {
    if (categoryOptions.length === 0) return;
    const hasSelected = categoryOptions.some((item) => item.name === category);
    if (!hasSelected) setCategory(categoryOptions[0]?.name || 'other');
  }, [category, categoryOptions]);

  const filteredCategoryOptions = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    if (!term) return categoryOptions;
    return categoryOptions.filter((item) => item.name.toLowerCase().includes(term));
  }, [categoryOptions, categorySearch]);

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => {
      const normalized = name.trim();
      const key = normalized.toLowerCase().replace(/\s+/g, '_');
      const icon = CATEGORY_ICONS[key] ? key : 'other';
      return api.wallet.createCategory({ name: normalized, icon });
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
      if (deleted && deleted.name === category) setCategory('other');
      queryClient.invalidateQueries({ queryKey: ['wallet', 'categories'] });
      showToast(t('categoryDeleted') || 'Category deleted', 'success');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('categoryDeleteFailed') || 'Failed to delete category', 'error');
    },
  });

  const mutation = useMutation({
    mutationFn: (data: TransactionRequest) => api.wallet.addTransaction(data),
    onSuccess: async (createdTransaction) => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['planner-board'] });
      if (userID) {
        queryClient.invalidateQueries({ queryKey: ['planner-board', userID] });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      if (userID) {
        queryClient.invalidateQueries({ queryKey: ['goals', userID] });
      }

      try {
        await linkTaskToTransactionIfNeeded({
          linkedTaskID,
          transactionID: createdTransaction.id,
          updateTask: api.tasks.update,
        });
      } catch (linkError) {
        showToast(
          linkError instanceof Error
            ? `Transaction saved, but task link failed: ${linkError.message}`
            : 'Transaction saved, but task link failed.',
          'warning'
        );
      }

      api.badges.check().then(() => {
        queryClient.invalidateQueries({ queryKey: ['badges'] });
      }).catch(() => {});
      showToast(t('transactionAdded') || 'Transaction added', 'success');

      // Reset form state so next visit starts clean
      setType('debit');
      setAmount('');
      setCurrency('TRY');
      setWalletCurrency('USD');
      setEnableTargetConversion(true);
      setCategory('other');
      setCategorySearch('');
      setNewCategoryName('');
      setDescription('');
      setStep('basics');
      setShowAllCategories(false);

      if (returnTo) {
        router.replace(returnTo as any);
      } else {
        router.back();
      }
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
    if (type === 'debit' && sourceWalletState.hasInsufficientSourceBalance) {
      setError(
        `${t('sourceWalletInsufficientBalance') || 'Insufficient source wallet balance'}: ${formatCompactCurrency(
          sourceWalletState.sourceWalletBalance,
          sourceWalletState.sourceWalletCurrency
        )}`
      );
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

  const validateStep = (stepToValidate: AddTransactionStep): boolean => {
    if (stepToValidate === 'basics') {
      if (!parsedAmount || parsedAmount <= 0) {
        setError(t('enterValidAmount'));
        return false;
      }
    }

    if (stepToValidate === 'currency') {
      if (enableTargetConversion && !walletCurrency.trim()) {
        setError(t('selectSourceWallet') || 'Select Source Wallet');
        return false;
      }
    }

    if (stepToValidate === 'category') {
      if (!category.trim()) {
        setError(t('categoryRequired') || 'Category is required');
        return false;
      }
    }

    setError('');
    return true;
  };

  const goToPreviousStep = () => {
    if (stepIndex <= 0) return;
    setStep(ADD_TRANSACTION_STEPS[stepIndex - 1]);
    setError('');
  };

  const goToNextStep = () => {
    if (!validateStep(step)) return;
    if (stepIndex >= ADD_TRANSACTION_STEPS.length - 1) return;
    setStep(ADD_TRANSACTION_STEPS[stepIndex + 1]);
    setError('');
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
        { text: t('delete') || 'Delete', style: 'destructive', onPress: () => deleteCategoryMutation.mutate(item.id!) },
      ]
    );
  };

  const handleAISuggestCategory = async () => {
    if (!description.trim()) return;
    setIsSuggestingCategory(true);
    try {
      const result = await api.ai.smartParse({ text: description });
      if (result.category && result.category !== 'other') {
        const catKey = result.category.toLowerCase().replace(/\s+/g, '_');
        const match = categoryOptions.find((c) => c.name.toLowerCase() === catKey);
        if (match) {
          setCategory(match.name);
          showToast(t('aiSuggestCategory') || `AI suggested: ${match.name}`, 'success');
        } else {
          setCategory(result.category);
          showToast(t('aiSuggestCategory') || `AI suggested: ${result.category}`, 'success');
        }
      }
    } catch {} finally {
      setIsSuggestingCategory(false);
    }
  };

  const currencyDisplay = getCurrencyDisplay(currency);

  const resolveCategoryLabel = (name: string) => {
    const translationKey = name.toLowerCase().replace(/\s+/g, '_');
    const translated = t(translationKey);
    return translated === translationKey ? name : translated;
  };

  const renderCurrencyChipList = (codes: string[], selectedCode: string, onSelect: (code: string) => void) => {
    const content = (
      <View style={{ flexDirection: 'row', flexWrap: shouldWrapCoreChoiceChips || isDesktop ? 'wrap' : 'nowrap', gap: theme.spacing.sm }}>
        {codes.map((code) => {
          const display = getCurrencyDisplay(code);
          const isSelected = selectedCode === code;
          return (
            <CurrencyChip key={code} $active={isSelected} onPress={() => onSelect(code)}>
              <Text style={{ marginRight: 4, fontSize: 14 }}>{display.flag || '🌐'}</Text>
              <BodyMedium
                $color={isSelected ? theme.colors.background : theme.colors.foreground}
                style={{ fontSize: 14 }}
              >
                {code}
              </BodyMedium>
            </CurrencyChip>
          );
        })}
      </View>
    );

    if (shouldWrapCoreChoiceChips || isDesktop) {
      return content;
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {content}
      </ScrollView>
    );
  };

  const renderSourceWalletDetails = ({ showDescription = true }: { showDescription?: boolean } = {}) => (
    <View
      style={{
        marginTop: theme.spacing.md,
        backgroundColor: sourceWalletState.hasInsufficientSourceBalance
          ? theme.colors.dangerMuted
          : theme.colors.secondary + '66',
        borderWidth: 1,
        borderColor: sourceWalletState.hasInsufficientSourceBalance
          ? theme.colors.danger + '55'
          : theme.colors.border,
        borderRadius: theme.radii.md,
        padding: theme.spacing.md,
      }}
    >
      <BodyMedium style={{ fontSize: 14, marginBottom: 4 }}>
        {t('sourceWallet') || 'Source Wallet'}
      </BodyMedium>
      {showDescription && (
        <Caption>{t('sourceWalletDescription') || 'Choose which wallet balance this transaction will affect. USD stays prefilled.'}</Caption>
      )}

      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
          <Caption>{t('amountCurrency') || 'Amount Currency'}</Caption>
          <BodyMedium style={{ fontSize: 14 }}>{sourceWalletState.amountCurrency}</BodyMedium>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
          <Caption>{t('sourceWallet') || 'Source Wallet'}</Caption>
          <BodyMedium style={{ fontSize: 14 }}>{sourceWalletState.sourceWalletCurrency}</BodyMedium>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
          <Caption>{t('sourceWalletImpact') || 'Wallet Impact'}</Caption>
          <BodyMedium
            style={{
              fontSize: 14,
              color: sourceWalletState.hasInsufficientSourceBalance ? theme.colors.danger : theme.colors.foreground,
            }}
          >
            {sourceWalletImpactLabel}
          </BodyMedium>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
          <Caption>{t('availableBalance') || 'Available balance'}</Caption>
          <BodyMedium
            style={{
              fontSize: 14,
              color: sourceWalletState.hasInsufficientSourceBalance ? theme.colors.danger : theme.colors.foreground,
            }}
          >
            {formatCompactCurrency(sourceWalletState.sourceWalletBalance, sourceWalletState.sourceWalletCurrency)}
          </BodyMedium>
        </View>
      </View>

      {!sourceWalletState.isCrossCurrency && (
        <Caption style={{ marginTop: theme.spacing.md }}>
          {t('sourceWalletMatchesAmount') || 'The source wallet matches the entered amount currency.'}
        </Caption>
      )}

      {sourceWalletState.isCrossCurrency && (
        <Caption style={{ marginTop: theme.spacing.md }}>
          {type === 'debit'
            ? t('sourceWalletDebitNotice') || `This expense will debit your ${sourceWalletState.sourceWalletCurrency} wallet.`
            : t('sourceWalletCreditNotice') || `This income will credit your ${sourceWalletState.sourceWalletCurrency} wallet.`}
        </Caption>
      )}

      {type === 'debit' && sourceWalletState.hasInsufficientSourceBalance && (
        <Caption $color={theme.colors.danger} style={{ marginTop: theme.spacing.md }}>
          {t('sourceWalletInsufficientBalance') || 'Insufficient source wallet balance'}
        </Caption>
      )}
    </View>
  );

  return (
    <ScreenContainer edges={isDesktop ? [] : ['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 12) : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: isDesktop ? 32 : theme.spacing.lg,
            maxWidth: isDesktop ? 800 : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: '100%',
            paddingBottom: bottomPadding,
          }}
        >
          <H2 style={{ marginBottom: theme.spacing.xxl, fontSize: isDesktop ? 24 : 22 }}>
            {t('addTransaction') || 'Add Transaction'}
          </H2>

          <FormError message={error} />

          <View style={{ marginBottom: theme.spacing.xl }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {ADD_TRANSACTION_STEPS.map((item, index) => {
                const active = item === step;
                const complete = index < stepIndex;
                return (
                  <View
                    key={item}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      borderRadius: theme.radii.md,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.accent : theme.colors.border,
                      backgroundColor: active ? theme.colors.accent + '22' : complete ? theme.colors.success + '1F' : theme.colors.card,
                    }}
                  >
                    <Caption
                      style={{
                        textAlign: 'center',
                        color: active ? theme.colors.accent : complete ? theme.colors.success : theme.colors.mutedForeground,
                        fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium',
                        fontSize: isCompactPhone ? 10 : 11,
                      }}
                      numberOfLines={1}
                    >
                      {`${index + 1}. ${(t((isCompactPhone ? STEP_LABEL_SHORT_KEYS : STEP_LABEL_KEYS)[item].key) || (isCompactPhone ? STEP_LABEL_SHORT_KEYS : STEP_LABEL_KEYS)[item].fallback)}`}
                    </Caption>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Desktop: Two column layout for type and amount */}
          {step === 'basics' && (
          <>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: isDesktop ? 24 : 0 }}>
            {/* Transaction Type */}
            <View style={{ marginBottom: theme.spacing.xl, flex: isDesktop ? 1 : undefined }}>
              <Caption style={{ marginBottom: theme.spacing.sm }}>{t('transactionType') || 'Transaction Type'}</Caption>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TypeButton $active={type === 'debit'} onPress={() => setType('debit')}>
                  <TrendingDown size={18} color={type === 'debit' ? theme.colors.primaryForeground : theme.colors.danger} />
                  <BodyMedium
                    $color={type === 'debit' ? theme.colors.background : theme.colors.foreground}
                    style={{ marginLeft: theme.spacing.sm, fontSize: 14 }}
                  >
                    {t('expense') || 'Expense'}
                  </BodyMedium>
                </TypeButton>
                <TypeButton $active={type === 'credit'} onPress={() => setType('credit')}>
                  <TrendingUp size={18} color={type === 'credit' ? theme.colors.primaryForeground : theme.colors.success} />
                  <BodyMedium
                    $color={type === 'credit' ? theme.colors.background : theme.colors.foreground}
                    style={{ marginLeft: theme.spacing.sm, fontSize: 14 }}
                  >
                    {t('income') || 'Income'}
                  </BodyMedium>
                </TypeButton>
              </View>
            </View>

            {/* Amount */}
            <View style={{ marginBottom: theme.spacing.xl, flex: isDesktop ? 1 : undefined }}>
              <Caption style={{ marginBottom: theme.spacing.sm }}>{t('amount') || 'Amount'}</Caption>
              <AmountContainer>
                <Text style={{ fontSize: 20, color: theme.colors.mutedForeground, marginRight: theme.spacing.sm }}>
                  {currencyDisplay.symbol}
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.mutedForeground}
                  selectionColor={theme.colors.accent}
                  cursorColor={theme.colors.accent}
                  style={{
                    flex: 1, padding: 14, fontSize: 20, fontFamily: 'Inter_600SemiBold',
                    color: theme.colors.foreground, outlineStyle: 'none',
                  } as any}
                />
              </AmountContainer>
            </View>
          </View>

          {/* Source Currency */}
          <View style={{ marginBottom: theme.spacing.xl }}>
            <Caption style={{ marginBottom: theme.spacing.sm }}>{t('currency') || 'Currency'}</Caption>
            {renderCurrencyChipList(CURRENCIES, currency, setCurrency)}
          </View>
          </>
          )}

          {/* Currency */}
          {step === 'currency' && (
            <>
              <View style={{ marginBottom: theme.spacing.xl }}>
                <Caption style={{ marginBottom: theme.spacing.sm }}>{t('currency') || 'Currency'}</Caption>
                {renderCurrencyChipList(CURRENCIES, currency, setCurrency)}
              </View>

              {/* Source wallet */}
              <SectionCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
                  <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                    <BodyMedium style={{ fontSize: 14 }}>{t('sourceWallet') || 'Source Wallet'}</BodyMedium>
                    <Caption style={{ marginTop: 4 }}>
                      {t('sourceWalletDescription') || 'Choose which wallet balance this transaction will affect. USD stays prefilled.'}
                    </Caption>
                  </View>
                  <Toggle value={enableTargetConversion} onValueChange={setEnableTargetConversion} />
                </View>

                {enableTargetConversion ? (
                  <>
                    <Caption style={{ marginBottom: theme.spacing.sm }}>{t('selectSourceWallet') || 'Select Source Wallet'}</Caption>
                    {renderCurrencyChipList(availableWalletCurrencies, walletCurrency, setWalletCurrency)}

                    {renderSourceWalletDetails()}

                    {shouldFetchConversionPreview && (
                      <View style={{
                        marginTop: theme.spacing.md,
                        backgroundColor: theme.colors.secondary + '66',
                        borderWidth: 1, borderColor: theme.colors.border,
                        borderRadius: theme.radii.md, padding: theme.spacing.md,
                      }}>
                        <BodyMedium style={{ fontSize: 14, marginBottom: theme.spacing.sm }}>{t('conversionPreview')}</BodyMedium>
                        {isLoadingConversionPreview ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={theme.colors.accent} />
                            <Caption style={{ marginLeft: theme.spacing.sm }}>{t('converting')}</Caption>
                          </View>
                        ) : isConversionPreviewError ? (
                          <Caption $color={theme.colors.danger}>{t('conversionFailed')}</Caption>
                        ) : conversionPreview ? (
                          <View>
                            <Caption>{`${formatCompactCurrency(parsedAmount, currency)} -> ${formatCompactCurrency(conversionPreview.result, walletCurrency)}`}</Caption>
                            <Caption style={{ marginTop: 4 }}>{`${t('rate')}: 1 ${currency} = ${conversionPreview.rate.toFixed(4)} ${walletCurrency}`}</Caption>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </>
                ) : (
                  renderSourceWalletDetails()
                )}
              </SectionCard>
            </>
          )}

          {/* Category */}
          {step === 'category' && (
            <>
          <SectionCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
              <Caption>{t('category')}</Caption>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {aiStatus?.configured && description.trim().length > 0 && (
                  <Pressable
                    onPress={handleAISuggestCategory}
                    disabled={isSuggestingCategory}
                    hitSlop={8}
                    style={{ marginRight: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.sm, paddingVertical: 4, borderRadius: theme.radii.md }}
                  >
                    {isSuggestingCategory ? (
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                    ) : (
                      <>
                        <Sparkles size={14} color={theme.colors.accent} />
                        <Text style={{ color: theme.colors.accent, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginLeft: 3 }}>AI</Text>
                      </>
                    )}
                  </Pressable>
                )}
                {isLoadingCategories && <ActivityIndicator size="small" color={theme.colors.accent} />}
              </View>
            </View>

            <SearchContainer>
              <Search size={15} color={theme.colors.secondaryForeground} />
              <TextInput
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder={t('searchCategories') || 'Search categories'}
                placeholderTextColor={theme.colors.mutedForeground}
                selectionColor={theme.colors.accent}
                cursorColor={theme.colors.accent}
                style={{
                  flex: 1, paddingVertical: 10, paddingHorizontal: 10,
                  color: theme.colors.foreground, fontSize: 14, outlineStyle: 'none',
                } as any}
              />
            </SearchContainer>

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
              <View style={{
                flex: 1, backgroundColor: theme.colors.secondary,
                borderWidth: 1, borderColor: theme.colors.border,
                borderRadius: theme.radii.md, paddingHorizontal: theme.spacing.md,
              }}>
                <TextInput
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder={t('newCategoryName') || 'New category name'}
                  placeholderTextColor={theme.colors.mutedForeground}
                  selectionColor={theme.colors.accent}
                  cursorColor={theme.colors.accent}
                  style={{
                    paddingVertical: 10, color: theme.colors.foreground,
                    fontSize: 14, outlineStyle: 'none',
                  } as any}
                />
              </View>
              <Pressable
                onPress={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
                style={{
                  minHeight: 44, paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: createCategoryMutation.isPending ? theme.colors.secondary : theme.colors.accent,
                  opacity: createCategoryMutation.isPending ? 0.6 : 1,
                }}
              >
                {createCategoryMutation.isPending ? (
                  <ActivityIndicator size="small" color={theme.colors.primaryForeground} />
                ) : (
                  <>
                    <Plus size={14} color={theme.colors.primaryForeground} />
                    <BodyMedium $color={theme.colors.accentForeground} style={{ marginLeft: 4, fontSize: 12 }}>
                      {t('addCategory') || 'Add'}
                    </BodyMedium>
                  </>
                )}
              </Pressable>
            </View>

            {filteredCategoryOptions.length === 0 ? (
              <View style={{
                backgroundColor: theme.colors.secondary + '4D',
                borderWidth: 1, borderColor: theme.colors.border + '99',
                borderRadius: theme.radii.md, padding: theme.spacing.md,
              }}>
                <Caption>{t('noCategoriesFound') || 'No categories found'}</Caption>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(showAllCategories || categorySearch.trim()
                    ? filteredCategoryOptions
                    : filteredCategoryOptions.slice(0, CATEGORY_PREVIEW_COUNT)
                  ).map((item) => {
                    const isSelected = category === item.name;
                    const canDelete = !item.is_default && !!item.id;
                    return (
                      <CategoryChip
                        key={`${item.id || 'default'}-${item.name}`}
                        $active={isSelected}
                        onPress={() => setCategory(item.name)}
                        style={{ width: categoryCardWidth }}
                      >
                        <CategoryIcon
                          category={item.name}
                          size={16}
                          color={isSelected ? theme.colors.primaryForeground : theme.colors.secondaryForeground}
                        />
                        <Caption
                          $color={isSelected ? theme.colors.background : theme.colors.foreground}
                          style={{ marginTop: 4, fontFamily: isSelected ? theme.typography.bodyMedium.fontFamily : theme.typography.caption.fontFamily }}
                          numberOfLines={1}
                        >
                          {resolveCategoryLabel(item.name)}
                        </Caption>
                        {canDelete && (
                          <Pressable
                            onPress={(event) => { event.stopPropagation(); handleDeleteCategory(item); }}
                            style={{ position: 'absolute', top: 4, right: 4, padding: 4 }}
                            hitSlop={8}
                          >
                            <Trash2 size={10} color={isSelected ? theme.colors.primaryForeground : theme.colors.danger} />
                          </Pressable>
                        )}
                      </CategoryChip>
                    );
                  })}
                </View>
                {!categorySearch.trim() && filteredCategoryOptions.length > CATEGORY_PREVIEW_COUNT && (
                  <Pressable
                    onPress={() => setShowAllCategories(!showAllCategories)}
                    style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: theme.spacing.sm }}
                  >
                    <BodyMedium $color={theme.colors.accent} style={{ fontSize: 14 }}>
                      {showAllCategories
                        ? (t('showLess') || 'Show less')
                        : (t('showAllCategories') || `Show all (${filteredCategoryOptions.length})`)}
                    </BodyMedium>
                  </Pressable>
                )}
              </>
            )}
          </SectionCard>

          {/* Description */}
          <View style={{ marginBottom: theme.spacing.xxl }}>
            <Caption style={{ marginBottom: theme.spacing.sm }}>{t('description') || 'Description'}</Caption>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('descriptionPlaceholder')}
              placeholderTextColor={theme.colors.mutedForeground}
              selectionColor={theme.colors.accent}
              cursorColor={theme.colors.accent}
              multiline
              style={{
                backgroundColor: theme.colors.secondary,
                borderWidth: 1, borderColor: theme.colors.borderStrong,
                borderRadius: theme.radii.md, padding: 14,
                color: theme.colors.foreground, fontSize: 16,
                minHeight: isDesktop ? 80 : 48, textAlignVertical: 'top',
                outlineStyle: 'none',
              } as any}
            />
          </View>
          </>
          )}

          {step === 'review' && (
            <SectionCard>
              <Caption style={{ marginBottom: theme.spacing.md }}>{t('review') || 'Review'}</Caption>

              <View style={{ marginBottom: theme.spacing.md }}>
                <BodyMedium style={{ marginBottom: 4 }}>{t('transactionType') || 'Transaction Type'}</BodyMedium>
                <Caption>{type === 'credit' ? (t('income') || 'Income') : (t('expense') || 'Expense')}</Caption>
              </View>

              <View style={{ marginBottom: theme.spacing.md }}>
                <BodyMedium style={{ marginBottom: 4 }}>{t('amount') || 'Amount'}</BodyMedium>
                <Caption>{formatCompactCurrency(parsedAmount || 0, currency)}</Caption>
              </View>

              <View style={{ marginBottom: theme.spacing.md }}>
                <BodyMedium style={{ marginBottom: 4 }}>{t('amountCurrency') || 'Amount Currency'}</BodyMedium>
                <Caption>{sourceWalletState.amountCurrency}</Caption>
              </View>

              {renderSourceWalletDetails({ showDescription: false })}

              <View style={{ marginBottom: theme.spacing.md }}>
                <BodyMedium style={{ marginBottom: 4 }}>{t('category') || 'Category'}</BodyMedium>
                <Caption>{resolveCategoryLabel(category)}</Caption>
              </View>

              <View style={{ marginBottom: theme.spacing.md }}>
                <BodyMedium style={{ marginBottom: 4 }}>{t('description') || 'Description'}</BodyMedium>
                <Caption>{description.trim() || (t('optional') || 'Optional')}</Caption>
              </View>

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                <Pressable
                  onPress={() => setStep('basics')}
                  style={({ pressed }) => [{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border }, pressed && { opacity: 0.76 }]}
                >
                  <Caption>{t(STEP_LABEL_KEYS.basics.key) || STEP_LABEL_KEYS.basics.fallback}</Caption>
                </Pressable>
                <Pressable
                  onPress={() => setStep('currency')}
                  style={({ pressed }) => [{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border }, pressed && { opacity: 0.76 }]}
                >
                  <Caption>{t(STEP_LABEL_KEYS.currency.key) || STEP_LABEL_KEYS.currency.fallback}</Caption>
                </Pressable>
                <Pressable
                  onPress={() => setStep('category')}
                  style={({ pressed }) => [{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border }, pressed && { opacity: 0.76 }]}
                >
                  <Caption>{t(STEP_LABEL_KEYS.category.key) || STEP_LABEL_KEYS.category.fallback}</Caption>
                </Pressable>
              </View>
            </SectionCard>
          )}

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              variant="outline"
              onPress={goToPreviousStep}
              disabled={stepIndex <= 0 || mutation.isPending}
              style={{ flex: 1 } as any}
            >
              {t('back') || 'Back'}
            </Button>

            {step === 'review' ? (
              <Button
                variant="accent"
                onPress={handleSubmit}
                isLoading={mutation.isPending}
                disabled={mutation.isPending || isReviewBlockedBySourceBalance}
                leftIcon={<Check size={18} color={theme.colors.primaryForeground} />}
                style={{ flex: 2 } as any}
              >
                {t('saveTransaction') || 'Save Transaction'}
              </Button>
            ) : (
              <Button
                variant="accent"
                onPress={goToNextStep}
                disabled={mutation.isPending}
                style={{ flex: 2 } as any}
              >
                {t('next') || 'Next'}
              </Button>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
