import { memo, useState, useCallback, useMemo, useEffect } from 'react';
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
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useAuth } from '../../../../src/context/AuthContext';
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
import { removeNoteBackup, upsertNoteBackup } from '../../../../src/offline/noteBackup';
import { haptics } from '../../../../src/utils/haptics';
import { HistoryFilterModal } from '../../../../src/components/features/History/HistoryFilterModal';
import { HistoryEditModal } from '../../../../src/components/features/History/HistoryEditModal';

const CATEGORIES = Object.keys(CATEGORY_ICONS);
const CURRENCIES = [...COMMON_CURRENCIES];

type HistoryColors = {
  accent: string;
  border: string;
  card: string;
  danger: string;
  foreground: string;
  info: string;
  mutedForeground: string;
  primaryForeground: string;
  success: string;
};
type TranslationFn = (key: string) => string | undefined;

interface TransactionRowProps {
  colors: HistoryColors;
  isDeletePending: boolean;
  isDesktop: boolean;
  onDelete: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
  onOpenNotes: (tx: Transaction) => void;
  t: TranslationFn;
  transaction: Transaction;
}

const TransactionRow = memo(function TransactionRow({
  colors,
  isDeletePending,
  isDesktop,
  onDelete,
  onEdit,
  onOpenNotes,
  t,
  transaction,
}: TransactionRowProps) {
  const isConversion =
    transaction.type === 'convert' ||
    transaction.type === 'convert_from' ||
    transaction.type === 'convert_to';

  const rightActions = useMemo(() => {
    const actions: SwipeAction[] = [
      {
        icon: 'delete',
        color: colors.foreground,
        backgroundColor: colors.danger,
        onPress: () => onDelete(transaction),
      },
    ];

    if (!isConversion) {
      actions.unshift({
        icon: 'edit',
        color: colors.foreground,
        backgroundColor: colors.info,
        onPress: () => onEdit(transaction),
      });
    }

    return actions;
  }, [colors.danger, colors.foreground, colors.info, isConversion, onDelete, onEdit, transaction]);

  const leftActions = useMemo(
    () => [
      {
        icon: 'note' as const,
        color: colors.primaryForeground,
        backgroundColor: colors.accent,
        onPress: () => onOpenNotes(transaction),
      },
    ],
    [colors.accent, colors.primaryForeground, onOpenNotes, transaction]
  );

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
        <View style={{ marginEnd: 12 }}>
          <StyledCategoryIcon
            category={transaction.category || 'other'}
            size={20}
            backgroundOpacity={0.15}
            borderRadius={10}
            padding={10}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }} numberOfLines={1}>
            {transaction.description || transaction.category || 'Transaction'}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }} numberOfLines={1}>
            {formatDate(transaction.created_at)} - {transaction.category || t('uncategorized')}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 18,
            fontFamily: 'Inter_600SemiBold',
            color: transaction.type === 'credit' ? colors.success : colors.danger,
          }}
          numberOfLines={1}
        >
          {formatTransactionAmount(transaction)}
        </Text>
        {isDesktop ? (
          <>
            <Pressable
              onPress={() => onOpenNotes(transaction)}
              hitSlop={10}
              style={({ pressed }) => [
                { marginStart: 8, padding: 8, cursor: 'pointer' },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel={t('transactionNotes') || 'Notes'}
              accessibilityRole="button"
            >
              <StickyNote size={18} color={colors.accent} />
            </Pressable>
            {!isConversion ? (
              <Pressable
                onPress={() => onEdit(transaction)}
                hitSlop={10}
                style={({ pressed }) => [
                  { marginStart: 4, padding: 8, cursor: 'pointer' },
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityLabel={t('editTransaction') || 'Edit'}
                accessibilityRole="button"
              >
                <Pencil size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => onDelete(transaction)}
              hitSlop={10}
              style={({ pressed }) => [
                { marginStart: 4, padding: 8, cursor: 'pointer' },
                pressed && { opacity: 0.7 },
              ]}
              disabled={isDeletePending}
              accessibilityLabel={t('deleteTransaction') || 'Delete'}
              accessibilityRole="button"
            >
              <Trash2 size={18} color={colors.mutedForeground} />
            </Pressable>
          </>
        ) : null}
      </View>
    </SwipeableRow>
  );
});

export default function TransactionHistoryScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: string | string[];
    from_date?: string | string[];
    to_date?: string | string[];
  }>();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const userID = user?.id ?? '';

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

  useEffect(() => {
    const readParam = (value?: string | string[]) => {
      if (Array.isArray(value)) {
        return value[0] || '';
      }
      return value || '';
    };

    const nextCategory = readParam(params.category);
    setFilterCategory(nextCategory || null);
    setFilterFromDate(readParam(params.from_date));
    setFilterToDate(readParam(params.to_date));
  }, [params.category, params.from_date, params.to_date]);

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
    onSuccess: async ({ note }) => {
      if (userID) {
        await upsertNoteBackup(userID, note);
      }
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
    onSuccess: async (_result, noteID) => {
      if (userID) {
        await removeNoteBackup(userID, noteID);
      }
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
          t('exportMobileNotice') || 'For secure CSV downloads, please use the web app at coai.koyeb.app. Mobile exports are not currently supported.',
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
  const renderTransactionItem = useCallback(
    ({ item }: { item: TransactionListItem }) => {
      if ('__skeleton' in item) {
        return <SkeletonTransaction />;
      }

      return (
        <TransactionRow
          colors={colors}
          isDeletePending={deleteMutation.isPending}
          isDesktop={isDesktop}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onOpenNotes={handleOpenNotes}
          t={t}
          transaction={item}
        />
      );
    },
    [
      colors,
      deleteMutation.isPending,
      handleDelete,
      handleEdit,
      handleOpenNotes,
      isDesktop,
      t,
    ]
  );

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
                <Text style={{ color: colors.accent, fontSize: 14, marginEnd: 4 }}>{filterCategory}</Text>
                <Pressable onPress={() => setFilterCategory(null)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={14} color={colors.accent} />
                </Pressable>
              </View>
            )}
            {filterType && (
              <View style={{ backgroundColor: colors.accent + '33', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.accent, fontSize: 14, marginEnd: 4 }}>{t(filterType)}</Text>
                <Pressable onPress={() => setFilterType(null)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={14} color={colors.accent} />
                </Pressable>
              </View>
            )}
            {(filterFromDate || filterToDate) && (
              <View style={{ backgroundColor: colors.accent + '33', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.accent, fontSize: 14, marginEnd: 4 }}>
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
        renderItem={renderTransactionItem}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={8}
        removeClippedSubviews={Platform.OS !== 'web'}
        contentContainerStyle={[
          historyStyles.listContent,
          {
            padding: isDesktop ? 32 : 16,
            paddingBottom: bottomPadding,
            flexGrow: !isPending && transactions.length === 0 ? 1 : undefined,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !isPending ? (
            <View
              style={[historyStyles.emptyContainer, { backgroundColor: colors.card, maxWidth: isDesktop ? 600 : '100%' }]}
            >
              <Text style={{ color: colors.mutedForeground }}>{t('noTransactions')}</Text>
            </View>
          ) : null
        }
      />

      {/* Filter Modal */}
      <HistoryFilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filterType={filterType}
        setFilterType={setFilterType}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterFromDate={filterFromDate}
        setFilterFromDate={setFilterFromDate}
        filterToDate={filterToDate}
        setFilterToDate={setFilterToDate}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      {/* Edit Modal */}
      <HistoryEditModal
        visible={showEditModal}
        onClose={resetEditModalState}
        editType={editType}
        setEditType={setEditType}
        editAmount={editAmount}
        setEditAmount={setEditAmount}
        editCurrency={editCurrency}
        setEditCurrency={setEditCurrency}
        editCategory={editCategory}
        setEditCategory={setEditCategory}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        onSave={handleSaveEdit}
        isSaving={updateMutation.isPending}
      />

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
            style={historyStyles.modalOverlay}
            onPress={handleCloseNotesModal}
          >
            <Pressable
              style={[historyStyles.bottomSheet, { backgroundColor: colors.card, maxHeight: '85%' }]}
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

              <ScrollView 
                showsVerticalScrollIndicator={false} 
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
              >
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
                        <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', marginStart: 8 }}>
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

const historyStyles = StyleSheet.create({
  listContent: {
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
    gap: 12,
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
});
