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
import { useRefreshableQuery } from '../../../../src/hooks/useRefreshableQuery';
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
  StickyNote,
  Plus,
} from 'lucide-react-native';
import { api, getAuthToken, API_BASE } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useTheme } from '../../../../src/context/ThemeContext';
import { useTheme as useStyledTheme } from 'styled-components/native';
import { formatDate, getCurrencyDisplay, formatTransactionAmount } from '../../../../src/utils/format';
import { StyledCategoryIcon, CATEGORY_ICONS, CategoryIcon } from '../../../../src/constants/icons';
import { SkeletonTransaction, SkeletonList } from '../../../../src/components/ui/Skeleton';
import { SwipeableRow, type SwipeAction } from '../../../../src/components/ui';
import { COMMON_CURRENCIES } from '../../../../src/constants/currencies';
import type { Transaction, TransactionFilter, UpdateTransactionRequest } from '../../../../src/types/wallet';
import type { Note, CreateNoteRequest } from '../../../../src/types/note';
import { haptics } from '../../../../src/utils/haptics';

const CATEGORIES = Object.keys(CATEGORY_ICONS);
const CURRENCIES = [...COMMON_CURRENCIES];

export default function TransactionHistoryScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;
  const iconColor = colors.foreground;

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

  // Notes state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedTransactionForNotes, setSelectedTransactionForNotes] = useState<Transaction | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

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

  const { data, isPending, refetch, refreshing, onRefresh } = useRefreshableQuery({
    queryKey: ['wallet', 'transactions', 'all', filter],
    queryFn: () => api.wallet.getTransactions(100, 0, hasActiveFilters ? filter : undefined),
  });

  // Fetch notes for selected transaction
  const { data: notesData, isPending: isLoadingNotes, refetch: refetchNotes } = useQuery({
    queryKey: ['notes', 'transaction', selectedTransactionForNotes?.id],
    queryFn: () => api.notes.getByTransaction(selectedTransactionForNotes!.id),
    enabled: !!selectedTransactionForNotes,
  });

  const transactionNotes = notesData?.notes || [];

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNoteRequest) => api.notes.create(data),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['notes', 'transaction', selectedTransactionForNotes?.id] });
      setNewNoteTitle('');
      setNewNoteContent('');
    },
    onError: (err) => {
      haptics.error();
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : t('failedToCreateNote') || 'Failed to create note'
      );
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => api.notes.delete(noteId),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['notes', 'transaction', selectedTransactionForNotes?.id] });
    },
  });

  const handleOpenNotes = useCallback((tx: Transaction) => {
    haptics.light();
    setSelectedTransactionForNotes(tx);
    setShowNotesModal(true);
  }, []);

  const handleCloseNotesModal = useCallback(() => {
    setShowNotesModal(false);
    setSelectedTransactionForNotes(null);
    setNewNoteTitle('');
    setNewNoteContent('');
  }, []);

  const handleAddNote = useCallback(() => {
    if (!selectedTransactionForNotes || !newNoteTitle.trim()) return;

    createNoteMutation.mutate({
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      transaction_id: selectedTransactionForNotes.id,
    });
  }, [selectedTransactionForNotes, newNoteTitle, newNoteContent, createNoteMutation]);

  const handleDeleteNote = useCallback((noteId: string) => {
    Alert.alert(
      t('deleteNote') || 'Delete Note',
      t('deleteNoteConfirm') || 'Are you sure you want to delete this note?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: () => deleteNoteMutation.mutate(noteId),
        },
      ]
    );
  }, [deleteNoteMutation, t]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.wallet.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error) => {
      Alert.alert(
        t('deleteFailed') || 'Delete Failed',
        error instanceof Error ? error.message : t('failedToDelete') || 'Failed to delete transaction'
      );
    },
  });

  const resetEditModalState = useCallback(() => {
    setShowEditModal(false);
    setEditingTransaction(null);
    setEditAmount('');
    setEditCurrency('USD');
    setEditCategory('other');
    setEditDescription('');
    setEditType('debit');
  }, []);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransactionRequest }) =>
      api.wallet.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      resetEditModalState();
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
        // Mobile export - recommend using web app for secure download
        Alert.alert(
          t('export') || 'Export',
          t('exportMobileNotice') || 'For secure CSV downloads, please use the web app at cofinance.app. Mobile exports are not currently supported.',
          [{ text: 'OK', style: 'default' }]
        );
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, maxWidth: 1400, width: '100%', alignSelf: 'center' }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [{ padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
          accessibilityLabel={t('back') || 'Go back'}
          accessibilityRole="button"
        >
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('transactionHistory')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Export Button */}
          <Pressable
            onPress={handleExport}
            disabled={isExporting || transactions.length === 0}
            hitSlop={8}
            style={({ pressed }) => [{ padding: 8, cursor: 'pointer', opacity: isExporting || transactions.length === 0 ? 0.5 : 1 }, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t('export') || 'Export transactions'}
            accessibilityRole="button"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={colors.placeholder} />
            ) : (
              <Download size={24} color={colors.placeholder} />
            )}
          </Pressable>
          {/* Filter Button */}
          <Pressable
            onPress={() => setShowFilterModal(true)}
            hitSlop={8}
            style={({ pressed }) => [{ padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t('filters') || 'Filter transactions'}
            accessibilityRole="button"
          >
            <Filter
              size={24}
              color={hasActiveFilters ? colors.accent : colors.placeholder}
            />
          </Pressable>
        </View>
      </View>

      {/* Active Filters Badge */}
      {hasActiveFilters && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, maxWidth: 1400, width: '100%', alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {filterCategory && (
              <View style={{ backgroundColor: colors.accent + '33', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.accent, fontSize: 14, marginRight: 4 }}>{filterCategory}</Text>
                <Pressable onPress={() => setFilterCategory(null)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={14} color={colors.accent} />
                </Pressable>
              </View>
            )}
            {filterType && (
              <View style={{ backgroundColor: colors.accent + '33', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.accent, fontSize: 14, marginRight: 4 }}>{t(filterType)}</Text>
                <Pressable onPress={() => setFilterType(null)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={14} color={colors.accent} />
                </Pressable>
              </View>
            )}
            {(filterFromDate || filterToDate) && (
              <View style={{ backgroundColor: colors.accent + '33', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.accent, fontSize: 14, marginRight: 4 }}>
                  {filterFromDate || '...'} - {filterToDate || '...'}
                </Text>
                <Pressable
                  onPress={() => {
                    setFilterFromDate('');
                    setFilterToDate('');
                  }}
                  hitSlop={12}
                  style={{ padding: 4 }}
                >
                  <X size={14} color={colors.accent} />
                </Pressable>
              </View>
            )}
            <Pressable onPress={clearFilters} style={{ paddingHorizontal: 12, paddingVertical: 4, minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t('clearFilters')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => {
          if ('__skeleton' in item) {
            return <SkeletonTransaction />;
          }

          const tx = item as Transaction;
          const isConversion = tx.type === 'convert' || tx.type === 'convert_from' || tx.type === 'convert_to';

          // Swipe actions
          const rightActions: SwipeAction[] = [
            {
              icon: 'delete',
              color: colors.foreground,
              backgroundColor: colors.danger,
              onPress: () => handleDelete(tx),
            },
          ];

          // Add edit action for non-conversions
          if (!isConversion) {
            rightActions.unshift({
              icon: 'edit',
              color: colors.foreground,
              backgroundColor: colors.info,
              onPress: () => handleEdit(tx),
            });
          }

          const leftActions: SwipeAction[] = [
            {
              icon: 'note',
              color: colors.primaryForeground,
              backgroundColor: colors.accent,
              onPress: () => handleOpenNotes(tx),
            },
          ];

          return (
            <SwipeableRow
              rightActions={rightActions}
              leftActions={leftActions}
              enabled={Platform.OS !== 'web'}
            >
              <View
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  width: isDesktop ? '48%' : '100%',
                  minWidth: 300,
                }}
              >
                <View style={{ marginRight: 12 }}>
                  <StyledCategoryIcon
                    category={tx.category || 'other'}
                    size={20}
                    backgroundOpacity={0.15}
                    borderRadius={10}
                    padding={10}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }} numberOfLines={1}>
                    {tx.description || tx.category || 'Transaction'}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14 }} numberOfLines={1}>
                    {formatDate(tx.created_at)} - {tx.category || t('uncategorized')}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: 'Inter_600SemiBold',
                    color: tx.type === 'credit' ? colors.success : colors.danger,
                  }}
                  numberOfLines={1}
                >
                  {formatTransactionAmount(tx)}
                </Text>
                {/* Desktop: Show buttons inline */}
                {isDesktop && (
                  <>
                    {/* Notes Button */}
                    <Pressable
                      onPress={() => handleOpenNotes(tx)}
                      hitSlop={10}
                      style={({ pressed }) => [{ marginLeft: 8, padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                      accessibilityLabel={t('transactionNotes') || 'Notes'}
                      accessibilityRole="button"
                    >
                      <StickyNote size={18} color={colors.accent} />
                    </Pressable>
                    {/* Edit Button */}
                    {!isConversion && (
                      <Pressable
                        onPress={() => handleEdit(tx)}
                        hitSlop={10}
                        style={({ pressed }) => [{ marginLeft: 4, padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                        accessibilityLabel={t('editTransaction') || 'Edit'}
                        accessibilityRole="button"
                      >
                        <Pencil size={18} color={colors.mutedForeground} />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => handleDelete(tx)}
                      hitSlop={10}
                      style={({ pressed }) => [{ marginLeft: 4, padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                      disabled={deleteMutation.isPending}
                      accessibilityLabel={t('deleteTransaction') || 'Delete'}
                      accessibilityRole="button"
                    >
                      <Trash2 size={18} color={colors.mutedForeground} />
                    </Pressable>
                  </>
                )}
              </View>
            </SwipeableRow>
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
              style={{ backgroundColor: colors.card, padding: 32, borderRadius: 12, alignItems: 'center', maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}
            >
              <Text style={{ color: colors.mutedForeground }}>{t('noTransactions')}</Text>
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
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setShowFilterModal(false)}
        >
          <Pressable
            style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('filters')}</Text>
              <Pressable onPress={() => setShowFilterModal(false)} hitSlop={8} style={({ pressed }) => [{ padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('close') || 'Close'} accessibilityRole="button">
                <X size={24} color={colors.placeholder} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
              {/* Type Filter */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('type')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => setFilterType(null)}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      backgroundColor: filterType === null ? colors.foreground : colors.secondary,
                      borderColor: filterType === null ? colors.foreground : colors.border,
                      cursor: 'pointer',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter_500Medium',
                        fontSize: 14,
                        color: filterType === null ? colors.background : colors.foreground,
                      }}
                    >
                      {t('allTypes')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFilterType('debit')}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      backgroundColor: filterType === 'debit' ? colors.foreground : colors.secondary,
                      borderColor: filterType === 'debit' ? colors.foreground : colors.border,
                      cursor: 'pointer',
                    }}
                  >
                    <TrendingDown
                      size={16}
                      color={filterType === 'debit' ? colors.primaryForeground : colors.danger}
                    />
                    <Text
                      style={{
                        fontFamily: 'Inter_500Medium',
                        marginLeft: 8,
                        fontSize: 14,
                        color: filterType === 'debit' ? colors.background : colors.foreground,
                      }}
                    >
                      {t('expenses')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFilterType('credit')}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      backgroundColor: filterType === 'credit' ? colors.foreground : colors.secondary,
                      borderColor: filterType === 'credit' ? colors.foreground : colors.border,
                      cursor: 'pointer',
                    }}
                  >
                    <TrendingUp
                      size={16}
                      color={filterType === 'credit' ? colors.primaryForeground : colors.success}
                    />
                    <Text
                      style={{
                        fontFamily: 'Inter_500Medium',
                        marginLeft: 8,
                        fontSize: 14,
                        color: filterType === 'credit' ? colors.background : colors.foreground,
                      }}
                    >
                      {t('income')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Category Filter */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('category')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Pressable
                    onPress={() => setFilterCategory(null)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 6,
                      borderWidth: 1,
                      backgroundColor: filterCategory === null ? colors.foreground : colors.secondary,
                      borderColor: filterCategory === null ? colors.foreground : colors.border,
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: filterCategory === null ? colors.background : colors.foreground,
                        fontFamily: filterCategory === null ? 'Inter_500Medium' : undefined,
                      }}
                    >
                      {t('allCategories')}
                    </Text>
                  </Pressable>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setFilterCategory(cat)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        borderWidth: 1,
                        backgroundColor: filterCategory === cat ? colors.foreground : colors.secondary,
                        borderColor: filterCategory === cat ? colors.foreground : colors.border,
                        cursor: 'pointer',
                        minHeight: 44,
                      }}
                    >
                      <CategoryIcon
                        category={cat}
                        size={14}
                        color={filterCategory === cat ? colors.primaryForeground : colors.secondaryForeground}
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          color: filterCategory === cat ? colors.background : colors.foreground,
                          fontFamily: filterCategory === cat ? 'Inter_500Medium' : undefined,
                        }}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Date Range Filter */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('fromDate')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12 }}>
                  <Calendar size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={{ flex: 1, padding: 12, color: colors.foreground, outlineStyle: 'none' } as any}
                    value={filterFromDate}
                    onChangeText={setFilterFromDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.subtleForeground}
                  />
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('toDate')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12 }}>
                  <Calendar size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={{ flex: 1, padding: 12, color: colors.foreground, outlineStyle: 'none' } as any}
                    value={filterToDate}
                    onChangeText={setFilterToDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.subtleForeground}
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={clearFilters}
                  style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', cursor: 'pointer' }}
                >
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{t('clearFilters')}</Text>
                </Pressable>
                <Pressable
                  onPress={applyFilters}
                  style={{ flex: 1, backgroundColor: colors.accent, padding: 12, borderRadius: 8, alignItems: 'center', cursor: 'pointer' }}
                >
                  <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium' }}>{t('filters')}</Text>
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
        onRequestClose={resetEditModalState}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            onPress={resetEditModalState}
          >
            <Pressable
              style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}
              onPress={(e) => e.stopPropagation()}
            >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('editTransaction')}</Text>
              <Pressable onPress={resetEditModalState} hitSlop={8} style={({ pressed }) => [{ padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('close') || 'Close'} accessibilityRole="button">
                <X size={24} color={colors.placeholder} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Transaction Type */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('transactionType')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => setEditType('debit')}
                    style={{
                      flex: 1,
                      padding: 14,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      backgroundColor: editType === 'debit' ? colors.foreground : colors.card,
                      borderColor: editType === 'debit' ? colors.foreground : colors.border,
                      cursor: 'pointer',
                    }}
                  >
                    <TrendingDown size={18} color={editType === 'debit' ? colors.primaryForeground : colors.danger} />
                    <Text
                      style={{
                        fontFamily: 'Inter_500Medium',
                        marginLeft: 8,
                        fontSize: 14,
                        color: editType === 'debit' ? colors.background : colors.foreground,
                      }}
                    >
                      {t('expenses')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditType('credit')}
                    style={{
                      flex: 1,
                      padding: 14,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      backgroundColor: editType === 'credit' ? colors.foreground : colors.card,
                      borderColor: editType === 'credit' ? colors.foreground : colors.border,
                      cursor: 'pointer',
                    }}
                  >
                    <TrendingUp size={18} color={editType === 'credit' ? colors.primaryForeground : colors.success} />
                    <Text
                      style={{
                        fontFamily: 'Inter_500Medium',
                        marginLeft: 8,
                        fontSize: 14,
                        color: editType === 'credit' ? colors.background : colors.foreground,
                      }}
                    >
                      {t('income')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Amount */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('amount')}</Text>
                <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                  <Text style={{ fontSize: 20, color: colors.mutedForeground, marginRight: 8 }}>
                    {getCurrencyDisplay(editCurrency).symbol}
                  </Text>
                  <TextInput
                    style={{ flex: 1, padding: 14, fontSize: 20, fontFamily: 'Inter_600SemiBold', color: colors.foreground, outlineStyle: 'none' } as any}
                    value={editAmount}
                    onChangeText={setEditAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.subtleForeground}
                  />
                </View>
              </View>

              {/* Currency */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('currency')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {CURRENCIES.map((code) => {
                      const display = getCurrencyDisplay(code);
                      return (
                        <Pressable
                          key={code}
                          onPress={() => setEditCurrency(code)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 6,
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderWidth: 1,
                            backgroundColor: editCurrency === code ? colors.foreground : colors.secondary,
                            borderColor: editCurrency === code ? colors.foreground : colors.border,
                            cursor: 'pointer',
                            minHeight: 44,
                          }}
                        >
                          <Text style={{ marginRight: 4, fontSize: 14 }}>{display.flag || ''}</Text>
                          <Text
                            style={{
                              fontSize: 14,
                              color: editCurrency === code ? colors.background : colors.foreground,
                              fontFamily: editCurrency === code ? 'Inter_500Medium' : undefined,
                            }}
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
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('category')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = editCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setEditCategory(cat)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          borderWidth: 1,
                          backgroundColor: isSelected ? colors.foreground : colors.secondary,
                          borderColor: isSelected ? colors.foreground : colors.border,
                          cursor: 'pointer',
                          minHeight: 44,
                        }}
                      >
                        <CategoryIcon
                          category={cat}
                          size={14}
                          color={isSelected ? colors.primaryForeground : colors.secondaryForeground}
                        />
                        <Text
                          style={{
                            fontSize: 14,
                            color: isSelected ? colors.background : colors.foreground,
                            fontFamily: isSelected ? 'Inter_500Medium' : undefined,
                          }}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Description */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('description')}</Text>
                <TextInput
                  style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, outlineStyle: 'none' } as any}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder={t('descriptionPlaceholder')}
                  placeholderTextColor={colors.subtleForeground}
                  multiline
                />
              </View>

              {/* Save Button */}
              <Pressable
                onPress={handleSaveEdit}
                disabled={updateMutation.isPending}
                style={{
                  backgroundColor: colors.accent,
                  padding: 14,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: updateMutation.isPending ? 0.5 : 1,
                  cursor: 'pointer',
                }}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Check size={18} color={colors.primaryForeground} />
                    <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>
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

      {/* Notes Modal */}
      <Modal
        visible={showNotesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseNotesModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            onPress={handleCloseNotesModal}
          >
            <Pressable
              style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                    {t('transactionNotes') || 'Transaction Notes'}
                  </Text>
                  {selectedTransactionForNotes && (
                    <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }} numberOfLines={1}>
                      {selectedTransactionForNotes.description || selectedTransactionForNotes.category || 'Transaction'}
                    </Text>
                  )}
                </View>
                <Pressable onPress={handleCloseNotesModal} hitSlop={8} style={({ pressed }) => [{ padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('close') || 'Close'} accessibilityRole="button">
                  <X size={24} color={colors.placeholder} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Existing Notes */}
                {isLoadingNotes ? (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <ActivityIndicator color={colors.accent} />
                  </View>
                ) : transactionNotes.length > 0 ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>
                      {t('existingNotes') || 'Existing Notes'} ({transactionNotes.length})
                    </Text>
                    {transactionNotes.map((note: Note) => (
                      <View
                        key={note.id}
                        style={{ backgroundColor: colors.muted, padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start' }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{note.title}</Text>
                          {note.content && (
                            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>{note.content}</Text>
                          )}
                          <Text style={{ color: colors.mutedForeground + '99', fontSize: 12, marginTop: 8 }}>
                            {formatDate(note.created_at)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handleDeleteNote(note.id)}
                          hitSlop={10}
                          style={({ pressed }) => [{ padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                          accessibilityLabel={t('deleteNote') || 'Delete note'}
                          accessibilityRole="button"
                        >
                          <Trash2 size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.muted + '80', padding: 16, borderRadius: 8, marginBottom: 16, alignItems: 'center' }}>
                    <StickyNote size={32} color={colors.placeholder} />
                    <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>
                      {t('noNotesForTransaction') || 'No notes for this transaction yet'}
                    </Text>
                  </View>
                )}

                {/* Add New Note */}
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>
                    {t('addNewNote') || 'Add New Note'}
                  </Text>
                  <TextInput
                    value={newNoteTitle}
                    onChangeText={setNewNoteTitle}
                    placeholder={t('noteTitle') || 'Note title...'}
                    placeholderTextColor={colors.mutedForeground}
                    style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 8, color: colors.foreground, marginBottom: 8, outlineStyle: 'none' } as any}
                  />
                  <TextInput
                    value={newNoteContent}
                    onChangeText={setNewNoteContent}
                    placeholder={t('noteContent') || 'Note content (optional)...'}
                    placeholderTextColor={colors.mutedForeground}
                    style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 8, color: colors.foreground, marginBottom: 12, minHeight: 80, outlineStyle: 'none' } as any}
                    multiline
                    textAlignVertical="top"
                  />
                  <Pressable
                    onPress={handleAddNote}
                    disabled={createNoteMutation.isPending || !newNoteTitle.trim()}
                    style={{
                      backgroundColor: colors.accent,
                      padding: 12,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: createNoteMutation.isPending || !newNoteTitle.trim() ? 0.5 : 1,
                      cursor: 'pointer',
                    }}
                  >
                    {createNoteMutation.isPending ? (
                      <ActivityIndicator color={colors.primaryForeground} size="small" />
                    ) : (
                      <>
                        <Plus size={18} color={colors.primaryForeground} />
                        <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>
                          {t('addNote') || 'Add Note'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
