import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  X,
  Check,
  CreditCard,
  HandCoins,
  DollarSign,
  Calendar,
  User,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from '../../src/context/ThemeContext';
import { formatCompactCurrency, formatDate } from '../../src/utils/format';
import { getCurrencyDisplay } from '../../src/utils/format';
import { haptics } from '../../src/utils/haptics';
import { COMMON_CURRENCIES } from '../../src/constants/currencies';
import type { Loan, CreateLoanRequest, LoanType, CreatePaymentRequest } from '../../src/types/loan';

const CURRENCIES = [...COMMON_CURRENCIES];

export default function LoansScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const isDesktop = width >= 1024;
  const bottomPadding = isDesktop ? insets.bottom : insets.bottom + 96;
  const iconColor = isDark ? 'rgb(248, 250, 252)' : 'rgb(51, 65, 85)';

  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [filter, setFilter] = useState<'all' | 'borrowed' | 'lent'>('all');

  // Form state
  const [formType, setFormType] = useState<LoanType>('borrowed');
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formInterestRate, setFormInterestRate] = useState('');
  const [formCounterparty, setFormCounterparty] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Queries
  const { data: loansData, isPending, refetch } = useQuery({
    queryKey: ['loans', filter === 'all' ? undefined : filter],
    queryFn: () => api.loans.list(undefined, filter === 'all' ? undefined : filter),
  });

  const { data: summary } = useQuery({
    queryKey: ['loans', 'summary'],
    queryFn: () => api.loans.getSummary(),
  });

  const loans = loansData?.loans || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateLoanRequest) => api.loans.create(data),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      resetForm();
      setShowCreateModal(false);
    },
    onError: (err) => {
      haptics.error();
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : t('failedToCreate') || 'Failed to create loan'
      );
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (data: { loanId: string; payment: CreatePaymentRequest }) =>
      api.loans.makePayment(data.loanId, data.payment),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setShowPaymentModal(false);
      setSelectedLoan(null);
      setPaymentAmount('');
      setPaymentNotes('');
    },
    onError: (err) => {
      haptics.error();
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : t('paymentFailed') || 'Payment failed'
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.loans.delete(id),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const resetForm = () => {
    setFormType('borrowed');
    setFormName('');
    setFormAmount('');
    setFormCurrency('USD');
    setFormInterestRate('');
    setFormCounterparty('');
    setFormDescription('');
  };

  const handleCreate = () => {
    const amount = parseFloat(formAmount);
    if (!formName.trim() || !amount || amount <= 0) {
      Alert.alert(t('error') || 'Error', t('fillRequiredFields') || 'Please fill required fields');
      return;
    }

    createMutation.mutate({
      type: formType,
      name: formName.trim(),
      principal_amount: amount,
      currency: formCurrency,
      interest_rate: formInterestRate ? parseFloat(formInterestRate) : undefined,
      counterparty: formCounterparty.trim() || undefined,
      description: formDescription.trim() || undefined,
    });
  };

  const handlePayment = () => {
    if (!selectedLoan) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert(t('error') || 'Error', t('enterValidAmount') || 'Please enter a valid amount');
      return;
    }

    paymentMutation.mutate({
      loanId: selectedLoan.id,
      payment: {
        amount,
        payment_type: 'payment',
        notes: paymentNotes.trim() || undefined,
      },
    });
  };

  const handleDelete = (loan: Loan) => {
    Alert.alert(
      t('deleteLoan') || 'Delete Loan',
      t('deleteLoanConfirm') || 'Are you sure you want to delete this loan?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(loan.id),
        },
      ]
    );
  };

  const openPaymentModal = (loan: Loan) => {
    haptics.light();
    setSelectedLoan(loan);
    setShowPaymentModal(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2" hitSlop={12}>
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">
          {t('loansAndDebts') || 'Loans & Debts'}
        </Text>
        <Pressable
          onPress={() => {
            haptics.light();
            setShowCreateModal(true);
          }}
          className="p-2"
        >
          <Plus size={24} color="rgb(212, 175, 55)" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: bottomPadding,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Card */}
        {summary && (
          <View className="bg-card border border-border p-5 rounded-xl mb-6">
            <Text className="text-base font-semibold text-foreground mb-4">
              {t('loanSummary') || 'Loan Summary'}
            </Text>
            <View className="flex-row justify-between mb-3">
              <View className="flex-1 items-center">
                <View className="flex-row items-center mb-1">
                  <TrendingDown size={16} color="#ef4444" />
                  <Text className="text-xs text-muted-foreground ml-1">
                    {t('youOwe') || 'You Owe'}
                  </Text>
                </View>
                <Text className="text-lg font-bold text-danger">
                  {formatCompactCurrency(summary.remaining_borrowed, summary.currency)}
                </Text>
              </View>
              <View className="flex-1 items-center">
                <View className="flex-row items-center mb-1">
                  <TrendingUp size={16} color="#22c55e" />
                  <Text className="text-xs text-muted-foreground ml-1">
                    {t('owedToYou') || 'Owed to You'}
                  </Text>
                </View>
                <Text className="text-lg font-bold text-success">
                  {formatCompactCurrency(summary.remaining_lent, summary.currency)}
                </Text>
              </View>
            </View>
            <View className="border-t border-border pt-3">
              <View className="flex-row items-center justify-center">
                <Text className="text-muted-foreground text-sm mr-2">
                  {t('netPosition') || 'Net Position'}:
                </Text>
                <Text
                  className={`text-lg font-bold ${
                    summary.net_debt > 0 ? 'text-danger' : 'text-success'
                  }`}
                >
                  {`${summary.net_debt > 0 ? '-' : '+'}${formatCompactCurrency(Math.abs(summary.net_debt), summary.currency)}`}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground text-center mt-1">
                {summary.net_debt > 0
                  ? t('netDebtor') || 'You are a net debtor'
                  : t('netCreditor') || 'You are a net creditor'}
              </Text>
            </View>
          </View>
        )}

        {/* Filter Tabs */}
        <View className="flex-row gap-2 mb-4">
          {(['all', 'borrowed', 'lent'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => {
                haptics.selection();
                setFilter(f);
              }}
              className={`flex-1 p-3 rounded-lg border ${
                filter === f
                  ? 'bg-foreground border-foreground'
                  : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-center text-sm font-medium ${
                  filter === f ? 'text-background' : 'text-foreground'
                }`}
              >
                {f === 'all' ? t('all') || 'All' : f === 'borrowed' ? t('borrowed') || 'Borrowed' : t('lent') || 'Lent'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Loans List */}
        {isPending ? (
          <View className="items-center py-8">
            <ActivityIndicator color="rgb(212, 175, 55)" />
          </View>
        ) : loans.length === 0 ? (
          <View className="bg-card border border-border p-8 rounded-xl items-center">
            <CreditCard size={48} color="#71717a" />
            <Text className="text-muted-foreground text-center mt-4">
              {t('noLoans') || 'No loans or debts yet'}
            </Text>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              className="bg-accent px-4 py-2 rounded-lg mt-4"
            >
              <Text className="text-accent-foreground font-medium">
                {t('addLoan') || 'Add Loan'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-3">
            {loans.map((loan) => {
              const progress = ((loan.principal_amount - loan.remaining_amount) / loan.principal_amount) * 100;
              const isBorrowed = loan.type === 'borrowed';
              const isOverdue = loan.due_date && new Date(loan.due_date) < new Date() && loan.status === 'active';

              return (
                <Pressable
                  key={loan.id}
                  onPress={() => openPaymentModal(loan)}
                  onLongPress={() => handleDelete(loan)}
                  className="bg-card border border-border p-4 rounded-xl"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-row items-center flex-1">
                      <View
                        className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                          isBorrowed ? 'bg-danger/20' : 'bg-success/20'
                        }`}
                      >
                        {isBorrowed ? (
                          <CreditCard size={20} color="#ef4444" />
                        ) : (
                          <HandCoins size={20} color="#22c55e" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold" numberOfLines={1}>
                          {loan.name}
                        </Text>
                        {loan.counterparty && (
                          <View className="flex-row items-center mt-0.5">
                            <User size={12} color="#71717a" />
                            <Text className="text-muted-foreground text-xs ml-1">
                              {isBorrowed ? t('from') || 'From' : t('to') || 'To'}: {loan.counterparty}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {isOverdue && (
                      <View className="bg-danger/20 px-2 py-1 rounded flex-row items-center">
                        <AlertCircle size={12} color="#ef4444" />
                        <Text className="text-danger text-xs ml-1">{t('overdue') || 'Overdue'}</Text>
                      </View>
                    )}
                  </View>

                  {/* Amount */}
                  <View className="flex-row items-baseline justify-between mb-2">
                    <Text className={`text-lg font-bold ${isBorrowed ? 'text-danger' : 'text-success'}`}>
                      {formatCompactCurrency(loan.remaining_amount, loan.currency)}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {t('of') || 'of'} {formatCompactCurrency(loan.principal_amount, loan.currency)}
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <View
                      className={`h-full ${isBorrowed ? 'bg-danger' : 'bg-success'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </View>

                  {/* Footer */}
                  <View className="flex-row items-center justify-between">
                    <Text className="text-muted-foreground text-xs">
                      {Math.round(progress)}% {t('paid') || 'paid'}
                    </Text>
                    {loan.due_date && (
                      <View className="flex-row items-center">
                        <Calendar size={12} color="#71717a" />
                        <Text className="text-muted-foreground text-xs ml-1">
                          {t('due') || 'Due'}: {formatDate(loan.due_date)}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Create Loan Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/50 justify-end"
            onPress={() => setShowCreateModal(false)}
          >
            <Pressable
              className="bg-card rounded-t-3xl p-6"
              style={{ maxHeight: '90%' }}
              onPress={(e) => e.stopPropagation()}
            >
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-xl font-bold text-foreground">
                  {t('newLoan') || 'New Loan'}
                </Text>
                <Pressable onPress={() => setShowCreateModal(false)}>
                  <X size={24} color="rgb(148, 163, 184)" />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Loan Type */}
                <View className="mb-5">
                  <Text className="text-muted-foreground text-sm mb-2">{t('type') || 'Type'}</Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setFormType('borrowed')}
                      className={`flex-1 p-4 rounded-lg border flex-row items-center justify-center ${
                        formType === 'borrowed'
                          ? 'bg-danger/10 border-danger'
                          : 'bg-card border-border'
                      }`}
                    >
                      <CreditCard size={20} color={formType === 'borrowed' ? '#ef4444' : '#71717a'} />
                      <Text
                        className={`ml-2 font-medium ${
                          formType === 'borrowed' ? 'text-danger' : 'text-foreground'
                        }`}
                      >
                        {t('borrowed') || 'I Borrowed'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setFormType('lent')}
                      className={`flex-1 p-4 rounded-lg border flex-row items-center justify-center ${
                        formType === 'lent'
                          ? 'bg-success/10 border-success'
                          : 'bg-card border-border'
                      }`}
                    >
                      <HandCoins size={20} color={formType === 'lent' ? '#22c55e' : '#71717a'} />
                      <Text
                        className={`ml-2 font-medium ${
                          formType === 'lent' ? 'text-success' : 'text-foreground'
                        }`}
                      >
                        {t('lent') || 'I Lent'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Name */}
                <View className="mb-5">
                  <Text className="text-muted-foreground text-sm mb-2">{t('name') || 'Name'} *</Text>
                  <TextInput
                    className="bg-muted border border-border p-3.5 rounded-lg text-foreground"
                    style={{ outlineStyle: 'none' } as any}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder={t('loanNamePlaceholder') || 'e.g., Car loan, Personal loan'}
                    placeholderTextColor="#71717a"
                  />
                </View>

                {/* Amount */}
                <View className="mb-5">
                  <Text className="text-muted-foreground text-sm mb-2">{t('amount') || 'Amount'} *</Text>
                  <View className="bg-muted border border-border rounded-lg flex-row items-center px-4">
                    <Text className="text-xl text-muted-foreground mr-2">
                      {getCurrencyDisplay(formCurrency).symbol}
                    </Text>
                    <TextInput
                      className="flex-1 p-3.5 text-xl font-semibold text-foreground"
                      style={{ outlineStyle: 'none' } as any}
                      value={formAmount}
                      onChangeText={setFormAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#52525b"
                    />
                  </View>
                </View>

                {/* Currency */}
                <View className="mb-5">
                  <Text className="text-muted-foreground text-sm mb-2">{t('currency') || 'Currency'}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-2">
                      {CURRENCIES.map((code) => {
                        const display = getCurrencyDisplay(code);
                        return (
                          <Pressable
                            key={code}
                            onPress={() => setFormCurrency(code)}
                            className={`px-3 py-2 rounded-md flex-row items-center border ${
                              formCurrency === code
                                ? 'bg-foreground border-foreground'
                                : 'bg-secondary border-border'
                            }`}
                          >
                            <Text className="mr-1 text-sm">{display.flag || ''}</Text>
                            <Text
                              className={`text-sm ${
                                formCurrency === code
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

                {/* Counterparty */}
                <View className="mb-5">
                  <Text className="text-muted-foreground text-sm mb-2">
                    {formType === 'borrowed' ? t('lender') || 'Lender' : t('borrower') || 'Borrower'}
                  </Text>
                  <View className="flex-row items-center bg-muted border border-border rounded-lg px-3">
                    <User size={18} color="#71717a" />
                    <TextInput
                      className="flex-1 p-3.5 text-foreground"
                      style={{ outlineStyle: 'none' } as any}
                      value={formCounterparty}
                      onChangeText={setFormCounterparty}
                      placeholder={t('personOrCompany') || 'Person or company name'}
                      placeholderTextColor="#71717a"
                    />
                  </View>
                </View>

                {/* Interest Rate */}
                <View className="mb-5">
                  <Text className="text-muted-foreground text-sm mb-2">
                    {t('interestRate') || 'Interest Rate'} (%)
                  </Text>
                  <TextInput
                    className="bg-muted border border-border p-3.5 rounded-lg text-foreground"
                    style={{ outlineStyle: 'none' } as any}
                    value={formInterestRate}
                    onChangeText={setFormInterestRate}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#71717a"
                  />
                </View>

                {/* Description */}
                <View className="mb-6">
                  <Text className="text-muted-foreground text-sm mb-2">
                    {t('description') || 'Description'}
                  </Text>
                  <TextInput
                    className="bg-muted border border-border p-3.5 rounded-lg text-foreground"
                    style={{ outlineStyle: 'none', minHeight: 80 } as any}
                    value={formDescription}
                    onChangeText={setFormDescription}
                    placeholder={t('loanDescriptionPlaceholder') || 'Additional notes...'}
                    placeholderTextColor="#71717a"
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* Create Button */}
                <Pressable
                  onPress={handleCreate}
                  disabled={createMutation.isPending}
                  className={`bg-accent p-4 rounded-lg flex-row items-center justify-center ${
                    createMutation.isPending ? 'opacity-50' : ''
                  }`}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#09090b" />
                  ) : (
                    <>
                      <Check size={20} color="#09090b" />
                      <Text className="text-accent-foreground font-semibold ml-2">
                        {t('createLoan') || 'Create Loan'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/50 justify-end"
            onPress={() => setShowPaymentModal(false)}
          >
            <Pressable
              className="bg-card rounded-t-3xl p-6"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-xl font-bold text-foreground">
                  {t('makePayment') || 'Make Payment'}
                </Text>
                <Pressable onPress={() => setShowPaymentModal(false)}>
                  <X size={24} color="rgb(148, 163, 184)" />
                </Pressable>
              </View>

              {selectedLoan && (
                <>
                  <View className="bg-muted p-4 rounded-lg mb-4">
                    <Text className="text-foreground font-semibold">{selectedLoan.name}</Text>
                    <Text className="text-muted-foreground text-sm mt-1">
                      {t('remaining') || 'Remaining'}:{' '}
                      {formatCompactCurrency(selectedLoan.remaining_amount, selectedLoan.currency)}
                    </Text>
                  </View>

                  <View className="mb-5">
                    <Text className="text-muted-foreground text-sm mb-2">
                      {t('paymentAmount') || 'Payment Amount'}
                    </Text>
                    <View className="bg-muted border border-border rounded-lg flex-row items-center px-4">
                      <Text className="text-xl text-muted-foreground mr-2">
                        {getCurrencyDisplay(selectedLoan.currency).symbol}
                      </Text>
                      <TextInput
                        className="flex-1 p-3.5 text-xl font-semibold text-foreground"
                        style={{ outlineStyle: 'none' } as any}
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#52525b"
                      />
                    </View>
                  </View>

                  <View className="mb-6">
                    <Text className="text-muted-foreground text-sm mb-2">
                      {t('notes') || 'Notes'}
                    </Text>
                    <TextInput
                      className="bg-muted border border-border p-3.5 rounded-lg text-foreground"
                      style={{ outlineStyle: 'none' } as any}
                      value={paymentNotes}
                      onChangeText={setPaymentNotes}
                      placeholder={t('paymentNotes') || 'Payment notes (optional)'}
                      placeholderTextColor="#71717a"
                    />
                  </View>

                  <Pressable
                    onPress={handlePayment}
                    disabled={paymentMutation.isPending}
                    className={`bg-accent p-4 rounded-lg flex-row items-center justify-center ${
                      paymentMutation.isPending ? 'opacity-50' : ''
                    }`}
                  >
                    {paymentMutation.isPending ? (
                      <ActivityIndicator color="#09090b" />
                    ) : (
                      <>
                        <DollarSign size={20} color="#09090b" />
                        <Text className="text-accent-foreground font-semibold ml-2">
                          {t('recordPayment') || 'Record Payment'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
