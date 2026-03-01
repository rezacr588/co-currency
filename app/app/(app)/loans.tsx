import { useState } from 'react';
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
import { useRefreshableQuery } from '../../src/hooks/useRefreshableQuery';
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
import { useTheme as useStyledTheme } from 'styled-components/native';
import { formatCompactCurrency, formatDate } from '../../src/utils/format';
import { getCurrencyDisplay } from '../../src/utils/format';
import { haptics } from '../../src/utils/haptics';
import { COMMON_CURRENCIES } from '../../src/constants/currencies';
import { Button } from '../../src/components/ui/Button';
import { SkeletonCard, SkeletonList } from '../../src/components/ui/Skeleton';
import type { Loan, CreateLoanRequest, LoanType, CreatePaymentRequest } from '../../src/types/loan';

const CURRENCIES = [...COMMON_CURRENCIES];

export default function LoansScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;

  const isDesktop = width >= 1024;
  const bottomPadding = isDesktop ? insets.bottom : insets.bottom + 96;
  const iconColor = colors.foreground;

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
  const { data: loansData, isPending, refetch, refreshing, onRefresh } = useRefreshableQuery({
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }} hitSlop={12}>
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
          {t('loansAndDebts') || 'Loans & Debts'}
        </Text>
        <Pressable
          onPress={() => {
            haptics.light();
            setShowCreateModal(true);
          }}
          style={{ padding: 8 }}
        >
          <Plus size={24} color={colors.accent} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: bottomPadding,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Card */}
        {summary && (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 12, marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 16 }}>
              {t('loanSummary') || 'Loan Summary'}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <TrendingDown size={16} color={colors.danger} />
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: 4 }}>
                    {t('youOwe') || 'You Owe'}
                  </Text>
                </View>
                <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.danger }}>
                  {formatCompactCurrency(summary.remaining_borrowed, summary.currency)}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <TrendingUp size={16} color={colors.success} />
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: 4 }}>
                    {t('owedToYou') || 'Owed to You'}
                  </Text>
                </View>
                <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.success }}>
                  {formatCompactCurrency(summary.remaining_lent, summary.currency)}
                </Text>
              </View>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginRight: 8 }}>
                  {t('netPosition') || 'Net Position'}:
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: 'Inter_700Bold',
                    color: summary.net_debt > 0 ? colors.danger : colors.success,
                  }}
                >
                  {`${summary.net_debt > 0 ? '-' : '+'}${formatCompactCurrency(Math.abs(summary.net_debt), summary.currency)}`}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
                {summary.net_debt > 0
                  ? t('netDebtor') || 'You are a net debtor'
                  : t('netCreditor') || 'You are a net creditor'}
              </Text>
            </View>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {(['all', 'borrowed', 'lent'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => {
                haptics.selection();
                setFilter(f);
              }}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: filter === f ? colors.foreground : colors.card,
                borderColor: filter === f ? colors.foreground : colors.border,
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: 14,
                  fontFamily: 'Inter_500Medium',
                  color: filter === f ? colors.background : colors.foreground,
                }}
              >
                {f === 'all' ? t('all') || 'All' : f === 'borrowed' ? t('borrowed') || 'Borrowed' : t('lent') || 'Lent'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Loans List */}
        {isPending ? (
          <SkeletonList count={3} ItemComponent={SkeletonCard} />
        ) : loans.length === 0 ? (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 32, borderRadius: 12, alignItems: 'center' }}>
            <CreditCard size={48} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 16 }}>
              {t('noLoans') || 'No loans or debts yet'}
            </Text>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              style={{ backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginTop: 16 }}
            >
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium' }}>
                {t('addLoan') || 'Add Loan'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {loans.map((loan) => {
              const progress = ((loan.principal_amount - loan.remaining_amount) / loan.principal_amount) * 100;
              const isBorrowed = loan.type === 'borrowed';
              const isOverdue = loan.due_date && new Date(loan.due_date) < new Date() && loan.status === 'active';

              return (
                <Pressable
                  key={loan.id}
                  onPress={() => openPaymentModal(loan)}
                  onLongPress={() => handleDelete(loan)}
                  style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 9999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                          backgroundColor: isBorrowed ? colors.danger + '33' : colors.success + '33',
                        }}
                      >
                        {isBorrowed ? (
                          <CreditCard size={20} color={colors.danger} />
                        ) : (
                          <HandCoins size={20} color={colors.success} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>
                          {loan.name}
                        </Text>
                        {loan.counterparty && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <User size={12} color={colors.mutedForeground} />
                            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 4 }}>
                              {isBorrowed ? t('from') || 'From' : t('to') || 'To'}: {loan.counterparty}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {isOverdue && (
                      <View style={{ backgroundColor: colors.danger + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center' }}>
                        <AlertCircle size={12} color={colors.danger} />
                        <Text style={{ color: colors.danger, fontSize: 12, marginLeft: 4 }}>{t('overdue') || 'Overdue'}</Text>
                      </View>
                    )}
                  </View>

                  {/* Amount */}
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: isBorrowed ? colors.danger : colors.success }}>
                      {formatCompactCurrency(loan.remaining_amount, loan.currency)}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                      {t('of') || 'of'} {formatCompactCurrency(loan.principal_amount, loan.currency)}
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={{ height: 8, backgroundColor: colors.muted, borderRadius: 9999, overflow: 'hidden', marginBottom: 8 }}>
                    <View
                      style={{ height: '100%', backgroundColor: isBorrowed ? colors.danger : colors.success, width: `${progress}%` }}
                    />
                  </View>

                  {/* Footer */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {Math.round(progress)}% {t('paid') || 'paid'}
                    </Text>
                    {loan.due_date && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Calendar size={12} color={colors.mutedForeground} />
                        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 4 }}>
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
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            onPress={() => setShowCreateModal(false)}
          >
            <Pressable
              style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' }}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                  {t('newLoan') || 'New Loan'}
                </Text>
                <Pressable onPress={() => setShowCreateModal(false)}>
                  <X size={24} color={colors.placeholder} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Loan Type */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('type') || 'Type'}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => setFormType('borrowed')}
                      style={{
                        flex: 1,
                        padding: 16,
                        borderRadius: 8,
                        borderWidth: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: formType === 'borrowed' ? colors.danger + '1a' : colors.card,
                        borderColor: formType === 'borrowed' ? colors.danger : colors.border,
                      }}
                    >
                      <CreditCard size={20} color={formType === 'borrowed' ? colors.danger : colors.mutedForeground} />
                      <Text
                        style={{
                          marginLeft: 8,
                          fontFamily: 'Inter_500Medium',
                          color: formType === 'borrowed' ? colors.danger : colors.foreground,
                        }}
                      >
                        {t('borrowed') || 'I Borrowed'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setFormType('lent')}
                      style={{
                        flex: 1,
                        padding: 16,
                        borderRadius: 8,
                        borderWidth: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: formType === 'lent' ? colors.success + '1a' : colors.card,
                        borderColor: formType === 'lent' ? colors.success : colors.border,
                      }}
                    >
                      <HandCoins size={20} color={formType === 'lent' ? colors.success : colors.mutedForeground} />
                      <Text
                        style={{
                          marginLeft: 8,
                          fontFamily: 'Inter_500Medium',
                          color: formType === 'lent' ? colors.success : colors.foreground,
                        }}
                      >
                        {t('lent') || 'I Lent'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Name */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('name') || 'Name'} *</Text>
                  <TextInput
                    style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, outlineStyle: 'none' } as any}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder={t('loanNamePlaceholder') || 'e.g., Car loan, Personal loan'}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                {/* Amount */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('amount') || 'Amount'} *</Text>
                  <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                    <Text style={{ fontSize: 20, color: colors.mutedForeground, marginRight: 8 }}>
                      {getCurrencyDisplay(formCurrency).symbol}
                    </Text>
                    <TextInput
                      style={{ flex: 1, padding: 14, fontSize: 20, fontFamily: 'Inter_600SemiBold', color: colors.foreground, outlineStyle: 'none' } as any}
                      value={formAmount}
                      onChangeText={setFormAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.subtleForeground}
                    />
                  </View>
                </View>

                {/* Currency */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('currency') || 'Currency'}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {CURRENCIES.map((code) => {
                        const display = getCurrencyDisplay(code);
                        return (
                          <Pressable
                            key={code}
                            onPress={() => setFormCurrency(code)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 6,
                              flexDirection: 'row',
                              alignItems: 'center',
                              borderWidth: 1,
                              backgroundColor: formCurrency === code ? colors.foreground : colors.secondary,
                              borderColor: formCurrency === code ? colors.foreground : colors.border,
                            }}
                          >
                            <Text style={{ marginRight: 4, fontSize: 14 }}>{display.flag || ''}</Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: formCurrency === code ? colors.background : colors.foreground,
                                fontFamily: formCurrency === code ? 'Inter_500Medium' : undefined,
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

                {/* Counterparty */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>
                    {formType === 'borrowed' ? t('lender') || 'Lender' : t('borrower') || 'Borrower'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12 }}>
                    <User size={18} color={colors.mutedForeground} />
                    <TextInput
                      style={{ flex: 1, padding: 14, color: colors.foreground, outlineStyle: 'none' } as any}
                      value={formCounterparty}
                      onChangeText={setFormCounterparty}
                      placeholder={t('personOrCompany') || 'Person or company name'}
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>

                {/* Interest Rate */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>
                    {t('interestRate') || 'Interest Rate'} (%)
                  </Text>
                  <TextInput
                    style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, outlineStyle: 'none' } as any}
                    value={formInterestRate}
                    onChangeText={setFormInterestRate}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                {/* Description */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>
                    {t('description') || 'Description'}
                  </Text>
                  <TextInput
                    style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, outlineStyle: 'none', minHeight: 80 } as any}
                    value={formDescription}
                    onChangeText={setFormDescription}
                    placeholder={t('loanDescriptionPlaceholder') || 'Additional notes...'}
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* Create Button */}
                <Button
                  variant="accent"
                  size="lg"
                  onPress={handleCreate}
                  isLoading={createMutation.isPending}
                  leftIcon={<Check size={20} color={colors.primaryForeground} />}
                >
                  {t('createLoan') || 'Create Loan'}
                </Button>
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
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            onPress={() => setShowPaymentModal(false)}
          >
            <Pressable
              style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                  {t('makePayment') || 'Make Payment'}
                </Text>
                <Pressable onPress={() => setShowPaymentModal(false)}>
                  <X size={24} color={colors.placeholder} />
                </Pressable>
              </View>

              {selectedLoan && (
                <>
                  <View style={{ backgroundColor: colors.muted, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{selectedLoan.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>
                      {t('remaining') || 'Remaining'}:{' '}
                      {formatCompactCurrency(selectedLoan.remaining_amount, selectedLoan.currency)}
                    </Text>
                  </View>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>
                      {t('paymentAmount') || 'Payment Amount'}
                    </Text>
                    <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                      <Text style={{ fontSize: 20, color: colors.mutedForeground, marginRight: 8 }}>
                        {getCurrencyDisplay(selectedLoan.currency).symbol}
                      </Text>
                      <TextInput
                        style={{ flex: 1, padding: 14, fontSize: 20, fontFamily: 'Inter_600SemiBold', color: colors.foreground, outlineStyle: 'none' } as any}
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={colors.subtleForeground}
                      />
                    </View>
                  </View>

                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>
                      {t('notes') || 'Notes'}
                    </Text>
                    <TextInput
                      style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, outlineStyle: 'none' } as any}
                      value={paymentNotes}
                      onChangeText={setPaymentNotes}
                      placeholder={t('paymentNotes') || 'Payment notes (optional)'}
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>

                  <Button
                    variant="accent"
                    size="lg"
                    onPress={handlePayment}
                    isLoading={paymentMutation.isPending}
                    leftIcon={<DollarSign size={20} color={colors.primaryForeground} />}
                  >
                    {t('recordPayment') || 'Record Payment'}
                  </Button>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
