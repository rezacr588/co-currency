import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Alert,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Filter,
  Trash2,
  X,
  Pencil,
  Download,
  Check,
  TrendingUp,
  TrendingDown,
  Calendar,
} from 'lucide-react-native';
import { api, getAuthToken, API_BASE } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useTheme } from '../../../../src/context/ThemeContext';
import { formatCompactCurrency, formatDate, getCurrencyDisplay } from '../../../../src/utils/format';
import { StyledCategoryIcon, CATEGORY_ICONS, CategoryIcon } from '../../../../src/constants/icons';
import { SkeletonTransaction, SkeletonList } from '../../../../src/components/ui/Skeleton';
import { COMMON_CURRENCIES } from '../../../../src/constants/currencies';
import type { Transaction, TransactionFilter, UpdateTransactionRequest } from '../../../../src/types/wallet';

const CATEGORIES = Object.keys(CATEGORY_ICONS);
const CURRENCIES = [...COMMON_CURRENCIES];

export default function TransactionHistoryScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;
  const iconColor = isDark ? 'rgb(248, 250, 252)' : 'rgb(51, 65, 85)';

  // Filter state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'credit' | 'debit' | null>(null);
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState('USD');
  const [editCategory, setEditCategory] = useState('other');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<'credit' | 'debit'>('debit');

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Build filter object
  const filter: TransactionFilter = useMemo(() => {
    const f: TransactionFilter = {};
    if (filterCategory) f.category = filterCategory;
    if (filterType) f.type = filterType;
    if (filterFromDate) f.from_date = filterFromDate;
    if (filterToDate) f.to_date = filterToDate;
    return f;
  }, [filterCategory, filterType, filterFromDate, filterToDate]);

  const hasActiveFilters = filterCategory || filterType || filterFromDate || filterToDate;

  const { data, isPending } = useQuery({
    queryKey: ['wallet', 'transactions', 'all', filter],
    queryFn: () => api.wallet.getTransactions(100, 0, hasActiveFilters ? filter : undefined),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
    setRefreshing(false);
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.wallet.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransactionRequest }) =>
      api.wallet.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setShowEditModal(false);
      setEditingTransaction(null);
    },
    onError: (err) => {
      Alert.alert(t('updateFailed'), err instanceof Error ? err.message : t('updateFailed'));
    },
  });

  const handleDelete = useCallback(
    (tx: { id: string; description?: string; category?: string }) => {
      Alert.alert(t('deleteTransaction'), t('deleteTransactionConfirm'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(tx.id),
        },
      ]);
    },
    [deleteMutation, t]
  );

  const handleEdit = useCallback((tx: Transaction) => {
    // Don't allow editing conversions
    if (tx.type === 'convert' || tx.type === 'convert_from' || tx.type === 'convert_to') {
      Alert.alert(t('editTransaction'), t('cannotEditConversion'));
      return;
    }
    setEditingTransaction(tx);
    setEditAmount(tx.amount.toString());
    setEditCurrency(tx.currency);
    setEditCategory(tx.category || 'other');
    setEditDescription(tx.description || '');
    setEditType(tx.type as 'credit' | 'debit');
    setShowEditModal(true);
  }, [t]);

  const handleSaveEdit = useCallback(() => {
    if (!editingTransaction) return;

    const parsedAmount = parseFloat(editAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert(t('invalidAmount'));
      return;
    }

    updateMutation.mutate({
      id: editingTransaction.id,
      data: {
        type: editType,
        amount: parsedAmount,
        currency: editCurrency,
        category: editCategory,
        description: editDescription || undefined,
      },
    });
  }, [editingTransaction, editAmount, editType, editCurrency, editCategory, editDescription, updateMutation, t]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const token = getAuthToken();
      const exportUrl = api.wallet.exportTransactions('csv', hasActiveFilters ? filter : undefined);

      if (Platform.OS === 'web') {
        // For web, trigger download
        const fullUrl = exportUrl.startsWith('/') ? `${window.location.origin}${exportUrl}` : exportUrl;
        const response = await fetch(fullUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // For mobile, open the export URL in browser (will download the file)
        const { Linking } = await import('react-native');
        const fullUrl = exportUrl.startsWith('/api')
          ? `https://terrible-moselle-airez-1828dc33.koyeb.app${exportUrl}`
          : exportUrl;

        // Add token as query parameter for mobile download
        const urlWithAuth = `${fullUrl}&token=${token}`;

        // Open in browser to trigger download
        const canOpen = await Linking.canOpenURL(urlWithAuth);
        if (canOpen) {
          await Linking.openURL(urlWithAuth);
          Alert.alert(t('export'), t('exportStarted') || 'Export started. Check your browser downloads.');
        } else {
          Alert.alert(t('export'), t('exportNotAvailable') || 'Export is only available on web');
        }
      }
    } catch (error) {
      Alert.alert(t('export'), error instanceof Error ? error.message : t('failedToLoad'));
    } finally {
      setIsExporting(false);
    }
  }, [filter, hasActiveFilters, t]);

  const clearFilters = useCallback(() => {
    setFilterCategory(null);
    setFilterType(null);
    setFilterFromDate('');
    setFilterToDate('');
    setShowFilterModal(false);
  }, []);

  const applyFilters = useCallback(() => {
    setShowFilterModal(false);
  }, []);

  const transactions = data?.transactions || [];

  type TransactionListItem = Transaction | { id: string; __skeleton: true };
  const listData: TransactionListItem[] = isPending
    ? Array.from({ length: 5 }, (_, index) => ({ id: `s-${index}`, __skeleton: true }))
    : transactions;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View
        className="flex-row items-center justify-between p-4 border-b border-border"
        style={{ maxWidth: 1400, width: '100%', alignSelf: 'center' }}
      >
        <Pressable
          onPress={() => router.back()}
          className="p-2"
          hitSlop={12}
          style={{ cursor: 'pointer' }}
        >
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{t('transactionHistory')}</Text>
        <View className="flex-row items-center gap-2">
          {/* Export Button */}
          <Pressable
            onPress={handleExport}
            disabled={isExporting || transactions.length === 0}
            className="p-2"
            style={{ cursor: 'pointer', opacity: isExporting || transactions.length === 0 ? 0.5 : 1 }}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="rgb(148, 163, 184)" />
            ) : (
              <Download size={24} color="rgb(148, 163, 184)" />
            )}
          </Pressable>
          {/* Filter Button */}
          <Pressable
            onPress={() => setShowFilterModal(true)}
            className="p-2"
            style={{ cursor: 'pointer' }}
          >
            <Filter
              size={24}
              color={hasActiveFilters ? 'rgb(212, 175, 55)' : 'rgb(148, 163, 184)'}
            />
          </Pressable>
        </View>
      </View>

      {/* Active Filters Badge */}
      {hasActiveFilters && (
        <View className="px-4 py-2" style={{ maxWidth: 1400, width: '100%', alignSelf: 'center' }}>
          <View className="flex-row items-center gap-2 flex-wrap">
            {filterCategory && (
              <View className="bg-accent/20 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-accent text-sm mr-1">{filterCategory}</Text>
                <Pressable onPress={() => setFilterCategory(null)}>
                  <X size={14} color="rgb(212, 175, 55)" />
                </Pressable>
              </View>
            )}
            {filterType && (
              <View className="bg-accent/20 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-accent text-sm mr-1">{t(filterType)}</Text>
                <Pressable onPress={() => setFilterType(null)}>
                  <X size={14} color="rgb(212, 175, 55)" />
                </Pressable>
              </View>
            )}
            {(filterFromDate || filterToDate) && (
              <View className="bg-accent/20 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-accent text-sm mr-1">
                  {filterFromDate || '...'} - {filterToDate || '...'}
                </Text>
                <Pressable
                  onPress={() => {
                    setFilterFromDate('');
                    setFilterToDate('');
                  }}
                >
                  <X size={14} color="rgb(212, 175, 55)" />
                </Pressable>
              </View>
            )}
            <Pressable onPress={clearFilters} className="px-3 py-1">
              <Text className="text-muted-foreground text-sm">{t('clearFilters')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if ('__skeleton' in item) {
            return <SkeletonTransaction />;
          }

          const tx = item as Transaction;
          return (
            <View
              className="bg-card border border-border p-4 rounded-xl flex-row items-center"
              style={{
                width: isDesktop ? '48%' : '100%',
                minWidth: 300,
              }}
            >
              <View className="mr-3">
                <StyledCategoryIcon
                  category={tx.category || 'other'}
                  size={20}
                  backgroundOpacity={0.15}
                  borderRadius={10}
                  padding={10}
                />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-foreground" numberOfLines={1}>
                  {tx.description || tx.category || 'Transaction'}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {formatDate(tx.created_at)} - {tx.category || t('uncategorized')}
                </Text>
              </View>
              <Text
                className={`text-lg font-semibold ${
                  tx.type === 'credit' ? 'text-success' : 'text-danger'
                }`}
              >
                {tx.type === 'credit' ? '+' : '-'}
                {formatCompactCurrency(tx.amount, tx.currency)}
              </Text>
              {/* Edit Button */}
              {tx.type !== 'convert' &&
                tx.type !== 'convert_from' &&
                tx.type !== 'convert_to' && (
                  <Pressable
                    onPress={() => handleEdit(tx)}
                    className="ml-2 p-2"
                    hitSlop={10}
                    style={{ cursor: 'pointer' }}
                  >
                    <Pencil size={18} color="#71717a" />
                  </Pressable>
                )}
              <Pressable
                onPress={() => handleDelete(tx)}
                className="ml-1 p-2"
                hitSlop={10}
                style={{ cursor: 'pointer' }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={18} color="#71717a" />
              </Pressable>
            </View>
          );
        }}
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: bottomPadding,
          flexGrow: !isPending && transactions.length === 0 ? 1 : undefined,
          gap: 12,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !isPending ? (
            <View
              className="bg-card p-8 rounded-xl items-center"
              style={{ maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}
            >
              <Text className="text-muted-foreground">{t('noTransactions')}</Text>
            </View>
          ) : null
        }
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowFilterModal(false)}
        >
          <Pressable
            className="bg-card rounded-t-3xl p-6"
            style={{ maxHeight: '80%' }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">{t('filters')}</Text>
              <Pressable onPress={() => setShowFilterModal(false)} style={{ cursor: 'pointer' }}>
                <X size={24} color="rgb(148, 163, 184)" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type Filter */}
              <View className="mb-5">
                <Text className="text-muted-foreground text-sm mb-2">{t('type')}</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setFilterType(null)}
                    style={{ cursor: 'pointer' }}
                    className={`flex-1 p-3 rounded-lg flex-row items-center justify-center border ${
                      filterType === null
                        ? 'bg-foreground border-foreground'
                        : 'bg-secondary border-border'
                    }`}
                  >
                    <Text
                      className={`font-medium text-sm ${
                        filterType === null ? 'text-background' : 'text-foreground'
                      }`}
                    >
                      {t('allTypes')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFilterType('debit')}
                    style={{ cursor: 'pointer' }}
                    className={`flex-1 p-3 rounded-lg flex-row items-center justify-center border ${
                      filterType === 'debit'
                        ? 'bg-foreground border-foreground'
                        : 'bg-secondary border-border'
                    }`}
                  >
                    <TrendingDown
                      size={16}
                      color={filterType === 'debit' ? '#09090b' : '#ef4444'}
                    />
                    <Text
                      className={`font-medium ml-2 text-sm ${
                        filterType === 'debit' ? 'text-background' : 'text-foreground'
                      }`}
                    >
                      {t('expenses')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFilterType('credit')}
                    style={{ cursor: 'pointer' }}
                    className={`flex-1 p-3 rounded-lg flex-row items-center justify-center border ${
                      filterType === 'credit'
                        ? 'bg-foreground border-foreground'
                        : 'bg-secondary border-border'
                    }`}
                  >
                    <TrendingUp
                      size={16}
                      color={filterType === 'credit' ? '#09090b' : '#22c55e'}
                    />
                    <Text
                      className={`font-medium ml-2 text-sm ${
                        filterType === 'credit' ? 'text-background' : 'text-foreground'
                      }`}
                    >
                      {t('income')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Category Filter */}
              <View className="mb-5">
                <Text className="text-muted-foreground text-sm mb-2">{t('category')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => setFilterCategory(null)}
                    style={{ cursor: 'pointer' }}
                    className={`px-3 py-2 rounded-md border ${
                      filterCategory === null
                        ? 'bg-foreground border-foreground'
                        : 'bg-secondary border-border'
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        filterCategory === null ? 'text-background font-medium' : 'text-foreground'
                      }`}
                    >
                      {t('allCategories')}
                    </Text>
                  </Pressable>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setFilterCategory(cat)}
                      style={{ cursor: 'pointer' }}
                      className={`px-3 py-2 rounded-md flex-row items-center gap-2 border ${
                        filterCategory === cat
                          ? 'bg-foreground border-foreground'
                          : 'bg-secondary border-border'
                      }`}
                    >
                      <CategoryIcon
                        category={cat}
                        size={14}
                        color={filterCategory === cat ? '#09090b' : '#a1a1aa'}
                      />
                      <Text
                        className={`text-sm ${
                          filterCategory === cat
                            ? 'text-background font-medium'
                            : 'text-foreground'
                        }`}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Date Range Filter */}
              <View className="mb-5">
                <Text className="text-muted-foreground text-sm mb-2">{t('fromDate')}</Text>
                <View className="flex-row items-center bg-muted border border-border rounded-lg px-3">
                  <Calendar size={18} color="#71717a" />
                  <TextInput
                    className="flex-1 p-3 text-foreground"
                    style={{ outlineStyle: 'none' } as any}
                    value={filterFromDate}
                    onChangeText={setFilterFromDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#52525b"
                  />
                </View>
              </View>

              <View className="mb-6">
                <Text className="text-muted-foreground text-sm mb-2">{t('toDate')}</Text>
                <View className="flex-row items-center bg-muted border border-border rounded-lg px-3">
                  <Calendar size={18} color="#71717a" />
                  <TextInput
                    className="flex-1 p-3 text-foreground"
                    style={{ outlineStyle: 'none' } as any}
                    value={filterToDate}
                    onChangeText={setFilterToDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#52525b"
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={clearFilters}
                  style={{ cursor: 'pointer' }}
                  className="flex-1 p-3 rounded-lg border border-border items-center"
                >
                  <Text className="text-foreground font-medium">{t('clearFilters')}</Text>
                </Pressable>
                <Pressable
                  onPress={applyFilters}
                  style={{ cursor: 'pointer' }}
                  className="flex-1 bg-accent p-3 rounded-lg items-center"
                >
                  <Text className="text-accent-foreground font-medium">{t('filters')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/50 justify-end"
            onPress={() => setShowEditModal(false)}
          >
            <Pressable
              className="bg-card rounded-t-3xl p-6"
              style={{ maxHeight: '85%' }}
              onPress={(e) => e.stopPropagation()}
            >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">{t('editTransaction')}</Text>
              <Pressable onPress={() => setShowEditModal(false)} style={{ cursor: 'pointer' }}>
                <X size={24} color="rgb(148, 163, 184)" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Transaction Type */}
              <View className="mb-5">
                <Text className="text-muted-foreground text-sm mb-2">{t('transactionType')}</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setEditType('debit')}
                    style={{ cursor: 'pointer' }}
                    className={`flex-1 p-3.5 rounded-lg flex-row items-center justify-center border ${
                      editType === 'debit'
                        ? 'bg-foreground border-foreground'
                        : 'bg-card border-border'
                    }`}
                  >
                    <TrendingDown size={18} color={editType === 'debit' ? '#09090b' : '#ef4444'} />
                    <Text
                      className={`font-medium ml-2 text-sm ${
                        editType === 'debit' ? 'text-background' : 'text-foreground'
                      }`}
                    >
                      {t('expenses')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditType('credit')}
                    style={{ cursor: 'pointer' }}
                    className={`flex-1 p-3.5 rounded-lg flex-row items-center justify-center border ${
                      editType === 'credit'
                        ? 'bg-foreground border-foreground'
                        : 'bg-card border-border'
                    }`}
                  >
                    <TrendingUp size={18} color={editType === 'credit' ? '#09090b' : '#22c55e'} />
                    <Text
                      className={`font-medium ml-2 text-sm ${
                        editType === 'credit' ? 'text-background' : 'text-foreground'
                      }`}
                    >
                      {t('income')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Amount */}
              <View className="mb-5">
                <Text className="text-muted-foreground text-sm mb-2">{t('amount')}</Text>
                <View className="bg-muted border border-border rounded-lg flex-row items-center px-4">
                  <Text className="text-xl text-muted-foreground mr-2">
                    {getCurrencyDisplay(editCurrency).symbol}
                  </Text>
                  <TextInput
                    className="flex-1 p-3.5 text-xl font-semibold text-foreground"
                    style={{ outlineStyle: 'none' } as any}
                    value={editAmount}
                    onChangeText={setEditAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#52525b"
                  />
                </View>
              </View>

              {/* Currency */}
              <View className="mb-5">
                <Text className="text-muted-foreground text-sm mb-2">{t('currency')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {CURRENCIES.map((code) => {
                      const display = getCurrencyDisplay(code);
                      return (
                        <Pressable
                          key={code}
                          onPress={() => setEditCurrency(code)}
                          style={{ cursor: 'pointer' }}
                          className={`px-3 py-2 rounded-md flex-row items-center border ${
                            editCurrency === code
                              ? 'bg-foreground border-foreground'
                              : 'bg-secondary border-border'
                          }`}
                        >
                          <Text className="mr-1 text-sm">{display.flag || ''}</Text>
                          <Text
                            className={`text-sm ${
                              editCurrency === code
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
              </View>

              {/* Category */}
              <View className="mb-5">
                <Text className="text-muted-foreground text-sm mb-2">{t('category')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = editCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setEditCategory(cat)}
                        style={{ cursor: 'pointer' }}
                        className={`px-3 py-2 rounded-md flex-row items-center gap-2 border ${
                          isSelected
                            ? 'bg-foreground border-foreground'
                            : 'bg-secondary border-border'
                        }`}
                      >
                        <CategoryIcon
                          category={cat}
                          size={14}
                          color={isSelected ? '#09090b' : '#a1a1aa'}
                        />
                        <Text
                          className={`text-sm ${
                            isSelected ? 'text-background font-medium' : 'text-foreground'
                          }`}
                        >
                          {cat}
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
                  style={{ outlineStyle: 'none' } as any}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder={t('descriptionPlaceholder')}
                  placeholderTextColor="#52525b"
                  multiline
                />
              </View>

              {/* Save Button */}
              <Pressable
                onPress={handleSaveEdit}
                disabled={updateMutation.isPending}
                style={{ cursor: 'pointer' }}
                className={`bg-accent p-3.5 rounded-lg flex-row items-center justify-center ${
                  updateMutation.isPending ? 'opacity-50' : ''
                }`}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator color="#09090b" />
                ) : (
                  <>
                    <Check size={18} color="#09090b" />
                    <Text className="text-accent-foreground font-semibold ml-2">
                      {t('saveChanges')}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
