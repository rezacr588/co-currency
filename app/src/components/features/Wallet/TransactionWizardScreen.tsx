import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react-native';
import styled, { useTheme } from 'styled-components/native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { formatCompactCurrency, getCurrencyDisplay } from '../../../utils/format';
import { CATEGORY_ICONS, CategoryIcon } from '../../../constants/icons';
import { COMMON_CURRENCIES } from '../../../constants/currencies';
import { useToast } from '../../ui/Toast';
import { Toggle } from '../../ui/Toggle';
import { FormError } from '../../ui/FormError';
import {
  MultiStepWizardScreen,
  WizardStepJumpChips,
  type MultiStepWizardItem,
} from '../../ui';
import { Caption, BodyMedium } from '../../ui/styled';
import type {
  AddTransactionDraft,
  AddTransactionStep,
  Category,
  TransactionRequest,
} from '../../../types/wallet';
import { linkTaskToTransactionIfNeeded } from '../../../utils/taskLinking';
import { getAddTransactionSourceWalletState } from '../../../utils/addTransactionSourceWallet';
import { useScreenLayout } from '../../../hooks/useScreenLayout';
import {
  ADD_TRANSACTION_DRAFT_VERSION,
  addTransactionDraftStorageKey,
  hasAddTransactionDraftContent,
  hasAddTransactionPrefill,
} from '../../../utils/addTransactionDraft';
import { readJSON, removeStorage, writeJSON } from '../../../utils/storage';

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

interface TransactionRouteParams {
  type?: string;
  amount?: string;
  currency?: string;
  wallet_currency?: string;
  category?: string;
  description?: string;
  linked_task_id?: string;
  return_to?: string;
}

export function TransactionWizardScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { width, isCompactPhone, isDesktop, isTablet } = useScreenLayout();
  const params = useLocalSearchParams() as TransactionRouteParams;
  const { showToast } = useToast();
  const userID = user?.id || '';

  const normalizedParams = useMemo<TransactionRouteParams>(() => ({
    type: typeof params.type === 'string' ? params.type : undefined,
    amount: typeof params.amount === 'string' ? params.amount : undefined,
    currency: typeof params.currency === 'string' ? params.currency : undefined,
    wallet_currency: typeof params.wallet_currency === 'string' ? params.wallet_currency : undefined,
    category: typeof params.category === 'string' ? params.category : undefined,
    description: typeof params.description === 'string' ? params.description : undefined,
    linked_task_id: typeof params.linked_task_id === 'string' ? params.linked_task_id : undefined,
    return_to: typeof params.return_to === 'string' ? params.return_to : undefined,
  }), [
    params.amount,
    params.category,
    params.currency,
    params.description,
    params.linked_task_id,
    params.return_to,
    params.type,
    params.wallet_currency,
  ]);

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
  const [showAllCategories, setShowAllCategories] = useState(false);

  const parsedAmount = Number.parseFloat(amount);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const stepIndex = ADD_TRANSACTION_STEPS.indexOf(step);
  const linkedTaskID = normalizedParams.linked_task_id?.trim() || '';
  const hasExplicitPrefill = hasAddTransactionPrefill(normalizedParams);
  const returnTo = normalizedParams.return_to?.trim()
    ? decodeURIComponent(normalizedParams.return_to)
    : '/finapp';

  const containerPadding = isDesktop ? 32 : 16;
  const categoryGap = 8;
  const availableWidth = width - containerPadding * 2;
  const categoryCols = isDesktop ? 6 : isTablet ? 4 : 2;
  const categoryCardWidth = (availableWidth - categoryGap * (categoryCols - 1)) / categoryCols;
  const categoryPreviewCount = isDesktop ? 18 : 8;
  const shouldWrapCoreChoiceChips = !isTablet && !isDesktop;

  const resetForm = useCallback(() => {
    setType('debit');
    setAmount('');
    setCurrency('TRY');
    setEnableTargetConversion(true);
    setWalletCurrency('USD');
    setCategory('other');
    setCategorySearch('');
    setNewCategoryName('');
    setDescription('');
    setError('');
    setStep('basics');
    setIsSuggestingCategory(false);
    setShowAllCategories(false);
  }, []);

  const applyPrefill = useCallback((prefill: TransactionRouteParams) => {
    if (prefill.type === 'credit' || prefill.type === 'debit') {
      setType(prefill.type);
    }
    if (prefill.amount?.trim()) {
      setAmount(prefill.amount);
    }
    if (prefill.currency?.trim()) {
      setCurrency(prefill.currency.toUpperCase());
    }
    if (prefill.wallet_currency?.trim()) {
      setWalletCurrency(prefill.wallet_currency.toUpperCase());
    }
    if (prefill.category?.trim()) {
      setCategory(prefill.category);
    }
    if (prefill.description?.trim()) {
      setDescription(prefill.description);
    }
  }, []);

  const applyDraft = useCallback((draft: AddTransactionDraft) => {
    setStep(draft.step);
    setType(draft.type);
    setAmount(draft.amount);
    setCurrency(draft.currency);
    setEnableTargetConversion(draft.enable_target_conversion);
    setWalletCurrency(draft.wallet_currency);
    setCategory(draft.category);
    setDescription(draft.description);
    setCategorySearch('');
    setNewCategoryName('');
    setError('');
    setShowAllCategories(false);
  }, []);

  useEffect(() => {
    resetForm();

    if (hasExplicitPrefill) {
      applyPrefill(normalizedParams);
      return;
    }

    if (!userID) return;

    let active = true;

    void (async () => {
      const stored = await readJSON<AddTransactionDraft>(addTransactionDraftStorageKey(userID));
      if (!stored || !active || stored.version !== ADD_TRANSACTION_DRAFT_VERSION) return;

      Alert.alert(
        t('transactionResumeDraft') || 'Resume transaction draft?',
        t('transactionResumeDraftMessage') || 'Continue where you left off in the transaction setup wizard?',
        [
          {
            text: t('transactionDiscardDraft') || 'Discard',
            style: 'destructive',
            onPress: () => {
              void removeStorage(addTransactionDraftStorageKey(userID));
            },
          },
          {
            text: t('transactionResume') || 'Resume',
            onPress: () => applyDraft(stored),
          },
        ],
      );
    })();

    return () => {
      active = false;
    };
  }, [applyDraft, applyPrefill, hasExplicitPrefill, normalizedParams, resetForm, t, userID]);

  useEffect(() => {
    if (!userID) return;

    const draft: AddTransactionDraft = {
      version: ADD_TRANSACTION_DRAFT_VERSION,
      updated_at: Date.now(),
      step,
      type,
      amount,
      currency,
      enable_target_conversion: enableTargetConversion,
      wallet_currency: walletCurrency,
      category,
      description,
    };

    const timeout = setTimeout(() => {
      if (hasAddTransactionDraftContent(draft)) {
        void writeJSON(addTransactionDraftStorageKey(userID), draft);
        return;
      }
      void removeStorage(addTransactionDraftStorageKey(userID));
    }, 420);

    return () => clearTimeout(timeout);
  }, [
    amount,
    category,
    currency,
    description,
    enableTargetConversion,
    step,
    type,
    userID,
    walletCurrency,
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
    return Array.from(new Set([...knownWalletCurrencies, ...CURRENCIES]));
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
    queryKey: ['wallet', 'transaction-create', 'conversion-preview', currency, walletCurrency, parsedAmount],
    queryFn: () => api.convert({ from: currency, to: walletCurrency, amount: parsedAmount }),
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
    balancesData?.balances,
    conversionPreview?.result,
    currency,
    enableTargetConversion,
    hasValidAmount,
    parsedAmount,
    type,
    walletCurrency,
  ]);

  const sourceWalletImpactLabel = useMemo(() => {
    if (sourceWalletState.sourceWalletAmount === null) {
      if (sourceWalletState.isCrossCurrency && isConversionPreviewError) {
        return t('sourceWalletPreviewUnavailable') || 'Unable to calculate wallet impact right now.';
      }
      return t('sourceWalletPreviewPending') || 'Calculating wallet impact...';
    }

    const signedAmount = `${type === 'debit' ? '-' : '+'}${formatCompactCurrency(
      sourceWalletState.sourceWalletAmount,
      sourceWalletState.sourceWalletCurrency
    )}`;
    return signedAmount;
  }, [
    isConversionPreviewError,
    sourceWalletState.isCrossCurrency,
    sourceWalletState.sourceWalletAmount,
    sourceWalletState.sourceWalletCurrency,
    t,
    type,
  ]);

  const isReviewBlockedBySourceBalance =
    type === 'debit' && sourceWalletState.hasInsufficientSourceBalance;

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

  const closeFlow = useCallback(() => {
    router.replace(returnTo as any);
  }, [returnTo, router]);

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

      if (userID) {
        await removeStorage(addTransactionDraftStorageKey(userID));
      }

      resetForm();
      showToast(t('transactionAdded') || 'Transaction added', 'success');
      closeFlow();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    },
  });

  const validateStep = useCallback((stepToValidate: AddTransactionStep): string | null => {
    if (stepToValidate === 'basics' && (!parsedAmount || parsedAmount <= 0)) {
      return t('enterValidAmount');
    }

    if (stepToValidate === 'currency' && enableTargetConversion && !walletCurrency.trim()) {
      return t('selectSourceWallet') || 'Select Source Wallet';
    }

    if (stepToValidate === 'category' && !category.trim()) {
      return t('categoryRequired') || 'Category is required';
    }

    return null;
  }, [category, enableTargetConversion, parsedAmount, t, walletCurrency]);

  const goToPreviousStep = useCallback(() => {
    if (stepIndex <= 0) return;
    setStep(ADD_TRANSACTION_STEPS[stepIndex - 1]);
    setError('');
  }, [stepIndex]);

  const goToNextStep = useCallback(() => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      Alert.alert(
        t('transactionCompleteStep') || 'Complete this step',
        validationError,
      );
      return;
    }

    if (stepIndex >= ADD_TRANSACTION_STEPS.length - 1) return;
    setError('');
    setStep(ADD_TRANSACTION_STEPS[stepIndex + 1]);
  }, [step, stepIndex, t, validateStep]);

  const handleCreateCategory = useCallback(() => {
    const name = newCategoryName.trim();
    if (!name) {
      setError(t('categoryRequired') || 'Category name is required');
      return;
    }
    setError('');
    createCategoryMutation.mutate(name);
  }, [createCategoryMutation, newCategoryName, t]);

  const handleDeleteCategory = useCallback((item: Category) => {
    if (!item.id || item.is_default) return;
    Alert.alert(
      t('deleteCategory') || 'Delete category',
      t('confirmDeleteCategory') || 'Are you sure you want to delete this category?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        { text: t('delete') || 'Delete', style: 'destructive', onPress: () => deleteCategoryMutation.mutate(item.id!) },
      ]
    );
  }, [deleteCategoryMutation, t]);

  const handleAISuggestCategory = useCallback(async () => {
    if (!description.trim()) return;
    setIsSuggestingCategory(true);
    try {
      const result = await api.ai.smartParse({ text: description });
      if (result.category && result.category !== 'other') {
        const catKey = result.category.toLowerCase().replace(/\s+/g, '_');
        const match = categoryOptions.find((item) => item.name.toLowerCase() === catKey);
        const suggestedCategory = match?.name || result.category;
        setCategory(suggestedCategory);
        showToast(t('aiSuggestCategory') || `AI suggested: ${suggestedCategory}`, 'success');
      }
    } catch {
      // Ignore AI suggestion errors and keep manual category selection available.
    } finally {
      setIsSuggestingCategory(false);
    }
  }, [categoryOptions, description, showToast, t]);

  const handleClose = useCallback(() => {
    closeFlow();
  }, [closeFlow]);

  const handleDiscard = useCallback(() => {
    Alert.alert(
      t('transactionDiscardConfirmTitle') || 'Discard draft?',
      t('transactionDiscardConfirmMessage') || 'All your progress on this transaction will be lost.',
      [
        { text: t('transactionClose') || 'Cancel', style: 'cancel' },
        {
          text: t('transactionDiscardDraft') || 'Discard',
          style: 'destructive',
          onPress: () => {
            resetForm();
            if (userID) {
              void removeStorage(addTransactionDraftStorageKey(userID));
            }
            closeFlow();
          },
        },
      ],
    );
  }, [closeFlow, resetForm, t, userID]);

  const handleSubmit = useCallback(() => {
    const basicsError = validateStep('basics');
    if (basicsError) {
      setStep('basics');
      setError(basicsError);
      Alert.alert(t('transactionCreateError') || 'Could not save transaction', basicsError);
      return;
    }

    const currencyError = validateStep('currency');
    if (currencyError) {
      setStep('currency');
      setError(currencyError);
      Alert.alert(t('transactionCreateError') || 'Could not save transaction', currencyError);
      return;
    }

    const categoryError = validateStep('category');
    if (categoryError) {
      setStep('category');
      setError(categoryError);
      Alert.alert(t('transactionCreateError') || 'Could not save transaction', categoryError);
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
  }, [
    category,
    currency,
    description,
    enableTargetConversion,
    mutation,
    parsedAmount,
    sourceWalletState.hasInsufficientSourceBalance,
    sourceWalletState.sourceWalletBalance,
    sourceWalletState.sourceWalletCurrency,
    t,
    type,
    validateStep,
    walletCurrency,
  ]);

  const currencyDisplay = getCurrencyDisplay(currency);

  const resolveCategoryLabel = useCallback((name: string) => {
    const translationKey = name.toLowerCase().replace(/\s+/g, '_');
    const translated = t(translationKey);
    return translated === translationKey ? name : translated;
  }, [t]);

  const stepLabels: Record<AddTransactionStep, string> = {
    basics: t('transactionStepBasics') || 'Basics',
    currency: t('transactionStepCurrency') || 'Currency',
    category: t('transactionStepCategory') || 'Category',
    review: t('transactionStepReview') || 'Review',
  };
  const shortStepLabels: Record<AddTransactionStep, string> = {
    basics: t('transactionStepBasicsShort') || 'Basics',
    currency: t('transactionStepCurrencyShort') || 'Currency',
    category: t('transactionStepCategoryShort') || 'Category',
    review: t('transactionStepReviewShort') || 'Review',
  };

  const stepItems: MultiStepWizardItem[] = ADD_TRANSACTION_STEPS.map((wizardStep) => ({
    key: wizardStep,
    label: stepLabels[wizardStep],
    shortLabel: shortStepLabels[wizardStep],
  }));

  const reviewJumpItems: MultiStepWizardItem[] = ADD_TRANSACTION_STEPS
    .filter((wizardStep) => wizardStep !== 'review')
    .map((wizardStep) => ({
      key: wizardStep,
      label: (t('transactionEditStep') || 'Edit {{step}}').replace('{{step}}', stepLabels[wizardStep]),
    }));

  const renderCurrencyChipList = (codes: string[], selectedCode: string, onSelect: (code: string) => void) => {
    const content = (
      <View style={{ flexDirection: 'row', flexWrap: shouldWrapCoreChoiceChips || isDesktop ? 'wrap' : 'nowrap', gap: theme.spacing.sm }}>
        {codes.map((code) => {
          const display = getCurrencyDisplay(code);
          const isSelected = selectedCode === code;
          return (
            <CurrencyChip key={code} $active={isSelected} onPress={() => onSelect(code)}>
              <Text style={{ marginEnd: 4, fontSize: 14 }}>{display.flag || '🌐'}</Text>
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
      {showDescription ? (
        <Caption>{t('sourceWalletDescription') || 'Choose which wallet balance this transaction will affect. USD stays prefilled.'}</Caption>
      ) : null}

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

      {!sourceWalletState.isCrossCurrency ? (
        <Caption style={{ marginTop: theme.spacing.md }}>
          {t('sourceWalletMatchesAmount') || 'The source wallet matches the entered amount currency.'}
        </Caption>
      ) : null}

      {sourceWalletState.isCrossCurrency ? (
        <Caption style={{ marginTop: theme.spacing.md }}>
          {type === 'debit'
            ? t('sourceWalletDebitNotice') || `This expense will debit your ${sourceWalletState.sourceWalletCurrency} wallet.`
            : t('sourceWalletCreditNotice') || `This income will credit your ${sourceWalletState.sourceWalletCurrency} wallet.`}
        </Caption>
      ) : null}

      {type === 'debit' && sourceWalletState.hasInsufficientSourceBalance ? (
        <Caption $color={theme.colors.danger} style={{ marginTop: theme.spacing.md }}>
          {t('sourceWalletInsufficientBalance') || 'Insufficient source wallet balance'}
        </Caption>
      ) : null}
    </View>
  );

  return (
    <MultiStepWizardScreen
      eyebrow={t('transactionWizardEyebrow') || 'Transaction Wizard'}
      title={stepLabels[step]}
      steps={stepItems}
      activeStep={step}
      onStepPress={(stepKey) => setStep(stepKey as AddTransactionStep)}
      onClose={handleClose}
      onDiscard={handleDiscard}
      onBack={goToPreviousStep}
      onPrimaryAction={step === 'review' ? handleSubmit : goToNextStep}
      primaryLabel={step === 'review' ? (t('transactionSave') || 'Save Transaction') : (t('transactionNext') || 'Next')}
      isPrimaryLoading={step === 'review' ? mutation.isPending : false}
      isPrimaryDisabled={step === 'review' ? isReviewBlockedBySourceBalance : false}
      canGoBack={stepIndex > 0 && !mutation.isPending}
      discardAccessibilityLabel={t('transactionDiscardDraft') || 'Discard draft'}
      closeLabel={t('transactionClose') || 'Close'}
      backLabel={t('transactionBack') || 'Back'}
    >
      {error ? (
        <View style={{ marginBottom: theme.spacing.xl }}>
          <FormError message={error} />
        </View>
      ) : null}

      {step === 'basics' ? (
        <>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: isDesktop ? 24 : 0 }}>
            <View style={{ marginBottom: theme.spacing.xl, flex: isDesktop ? 1 : undefined }}>
              <Caption style={{ marginBottom: theme.spacing.sm }}>{t('transactionType') || 'Transaction Type'}</Caption>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TypeButton $active={type === 'debit'} onPress={() => setType('debit')}>
                  <TrendingDown size={18} color={type === 'debit' ? theme.colors.primaryForeground : theme.colors.danger} />
                  <BodyMedium
                    $color={type === 'debit' ? theme.colors.background : theme.colors.foreground}
                    style={{ marginStart: theme.spacing.sm, fontSize: 14 }}
                  >
                    {t('expense') || 'Expense'}
                  </BodyMedium>
                </TypeButton>
                <TypeButton $active={type === 'credit'} onPress={() => setType('credit')}>
                  <TrendingUp size={18} color={type === 'credit' ? theme.colors.primaryForeground : theme.colors.success} />
                  <BodyMedium
                    $color={type === 'credit' ? theme.colors.background : theme.colors.foreground}
                    style={{ marginStart: theme.spacing.sm, fontSize: 14 }}
                  >
                    {t('income') || 'Income'}
                  </BodyMedium>
                </TypeButton>
              </View>
            </View>

            <View style={{ marginBottom: theme.spacing.xl, flex: isDesktop ? 1 : undefined }}>
              <Caption style={{ marginBottom: theme.spacing.sm }}>{t('amount') || 'Amount'}</Caption>
              <AmountContainer>
                <Text style={{ fontSize: 20, color: theme.colors.mutedForeground, marginEnd: theme.spacing.sm }}>
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
                    flex: 1,
                    padding: 14,
                    fontSize: 20,
                    fontFamily: 'Inter_600SemiBold',
                    color: theme.colors.foreground,
                    outlineStyle: 'none',
                  } as never}
                />
              </AmountContainer>
            </View>
          </View>

          <View style={{ marginBottom: theme.spacing.xl }}>
            <Caption style={{ marginBottom: theme.spacing.sm }}>{t('currency') || 'Currency'}</Caption>
            {renderCurrencyChipList(CURRENCIES, currency, setCurrency)}
          </View>
        </>
      ) : null}

      {step === 'currency' ? (
        <>
          <View style={{ marginBottom: theme.spacing.xl }}>
            <Caption style={{ marginBottom: theme.spacing.sm }}>{t('currency') || 'Currency'}</Caption>
            {renderCurrencyChipList(CURRENCIES, currency, setCurrency)}
          </View>

          <SectionCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
              <View style={{ flex: 1, paddingEnd: theme.spacing.md }}>
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

                {shouldFetchConversionPreview ? (
                  <View style={{
                    marginTop: theme.spacing.md,
                    backgroundColor: theme.colors.secondary + '66',
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                    padding: theme.spacing.md,
                  }}>
                    <BodyMedium style={{ fontSize: 14, marginBottom: theme.spacing.sm }}>{t('conversionPreview')}</BodyMedium>
                    {isLoadingConversionPreview ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={theme.colors.accent} />
                        <Caption style={{ marginStart: theme.spacing.sm }}>{t('converting')}</Caption>
                      </View>
                    ) : null}
                    {isConversionPreviewError ? (
                      <Caption $color={theme.colors.danger}>{t('conversionFailed')}</Caption>
                    ) : null}
                    {!isLoadingConversionPreview && !isConversionPreviewError && conversionPreview ? (
                      <View>
                        <Caption>{`${formatCompactCurrency(parsedAmount, currency)} -> ${formatCompactCurrency(conversionPreview.result, walletCurrency)}`}</Caption>
                        <Caption style={{ marginTop: 4 }}>{`${t('rate')}: 1 ${currency} = ${conversionPreview.rate.toFixed(4)} ${walletCurrency}`}</Caption>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : (
              renderSourceWalletDetails()
            )}
          </SectionCard>
        </>
      ) : null}

      {step === 'category' ? (
        <>
          <SectionCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
              <Caption>{t('category')}</Caption>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {aiStatus?.configured && description.trim().length > 0 ? (
                  <Pressable
                    onPress={handleAISuggestCategory}
                    disabled={isSuggestingCategory}
                    hitSlop={8}
                    style={{ marginEnd: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.sm, paddingVertical: 4, borderRadius: theme.radii.md }}
                  >
                    {isSuggestingCategory ? (
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                    ) : (
                      <>
                        <Sparkles size={14} color={theme.colors.accent} />
                        <Text style={{ color: theme.colors.accent, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginStart: 3 }}>AI</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
                {isLoadingCategories ? <ActivityIndicator size="small" color={theme.colors.accent} /> : null}
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
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  color: theme.colors.foreground,
                  fontSize: 14,
                  outlineStyle: 'none',
                } as never}
              />
            </SearchContainer>

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
              <View style={{
                flex: 1,
                backgroundColor: theme.colors.secondary,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                paddingHorizontal: theme.spacing.md,
              }}>
                <TextInput
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder={t('newCategoryName') || 'New category name'}
                  placeholderTextColor={theme.colors.mutedForeground}
                  selectionColor={theme.colors.accent}
                  cursorColor={theme.colors.accent}
                  style={{
                    paddingVertical: 10,
                    color: theme.colors.foreground,
                    fontSize: 14,
                    outlineStyle: 'none',
                  } as never}
                />
              </View>
              <Pressable
                onPress={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
                style={{
                  minHeight: 44,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radii.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: createCategoryMutation.isPending ? theme.colors.secondary : theme.colors.accent,
                  opacity: createCategoryMutation.isPending ? 0.6 : 1,
                }}
              >
                {createCategoryMutation.isPending ? (
                  <ActivityIndicator size="small" color={theme.colors.primaryForeground} />
                ) : (
                  <>
                    <Plus size={14} color={theme.colors.primaryForeground} />
                    <BodyMedium $color={theme.colors.accentForeground} style={{ marginStart: 4, fontSize: 12 }}>
                      {t('addCategory') || 'Add'}
                    </BodyMedium>
                  </>
                )}
              </Pressable>
            </View>

            {filteredCategoryOptions.length === 0 ? (
              <View style={{
                backgroundColor: theme.colors.secondary + '4D',
                borderWidth: 1,
                borderColor: theme.colors.border + '99',
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
              }}>
                <Caption>{t('noCategoriesFound') || 'No categories found'}</Caption>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(showAllCategories || categorySearch.trim()
                    ? filteredCategoryOptions
                    : filteredCategoryOptions.slice(0, categoryPreviewCount)
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
                        {canDelete ? (
                          <Pressable
                            onPress={(event) => {
                              event.stopPropagation();
                              handleDeleteCategory(item);
                            }}
                            style={{ position: 'absolute', top: 4, right: 4, padding: 4 }}
                            hitSlop={8}
                          >
                            <Trash2 size={10} color={isSelected ? theme.colors.primaryForeground : theme.colors.danger} />
                          </Pressable>
                        ) : null}
                      </CategoryChip>
                    );
                  })}
                </View>
                {!categorySearch.trim() && filteredCategoryOptions.length > categoryPreviewCount ? (
                  <Pressable
                    onPress={() => setShowAllCategories((value) => !value)}
                    style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: theme.spacing.sm }}
                  >
                    <BodyMedium $color={theme.colors.accent} style={{ fontSize: 14 }}>
                      {showAllCategories
                        ? (t('showLess') || 'Show less')
                        : (t('showAllCategories') || `Show all (${filteredCategoryOptions.length})`)}
                    </BodyMedium>
                  </Pressable>
                ) : null}
              </>
            )}
          </SectionCard>

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
                borderWidth: 1,
                borderColor: theme.colors.borderStrong,
                borderRadius: theme.radii.md,
                padding: 14,
                color: theme.colors.foreground,
                fontSize: 16,
                minHeight: isDesktop ? 80 : 48,
                textAlignVertical: 'top',
                outlineStyle: 'none',
              } as never}
            />
          </View>
        </>
      ) : null}

      {step === 'review' ? (
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

          <WizardStepJumpChips
            items={reviewJumpItems}
            onPress={(stepKey) => setStep(stepKey as AddTransactionStep)}
          />
        </SectionCard>
      ) : null}
    </MultiStepWizardScreen>
  );
}
