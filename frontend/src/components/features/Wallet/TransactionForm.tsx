import { useState, FormEvent, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { useCurrencies } from '../../../hooks';
import { Container } from '../../layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { WalletBalance } from '../../../types/wallet';
import { CURRENCY_FLAGS } from '../../../utils/constants';
import {
  Utensils,
  ShoppingCart,
  Banknote,
  Home,
  Car,
  Plane,
  Heart,
  Gamepad2,
  Smartphone,
  Lightbulb,
  Film,
  GraduationCap,
  Shirt,
  Gift,
  CreditCard,
  Building2,
  Package,
  Coffee,
  Pizza,
  Bus,
  Briefcase,
  Stethoscope,
  Music,
  Dumbbell,
  type LucideIcon,
  X,
  Search,
  Check,
  ChevronDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

// Transaction icons with Lucide
const TRANSACTION_ICONS: { icon: LucideIcon; label: string; key: string }[] = [
  { icon: Utensils, label: 'Food', key: 'food' },
  { icon: ShoppingCart, label: 'Shopping', key: 'shopping' },
  { icon: Banknote, label: 'Money', key: 'money' },
  { icon: Home, label: 'Home', key: 'home' },
  { icon: Car, label: 'Car', key: 'car' },
  { icon: Plane, label: 'Travel', key: 'travel' },
  { icon: Stethoscope, label: 'Health', key: 'health' },
  { icon: Gamepad2, label: 'Gaming', key: 'gaming' },
  { icon: Smartphone, label: 'Phone', key: 'phone' },
  { icon: Lightbulb, label: 'Utilities', key: 'utilities' },
  { icon: Film, label: 'Entertainment', key: 'entertainment' },
  { icon: GraduationCap, label: 'Education', key: 'education' },
  { icon: Shirt, label: 'Clothing', key: 'clothing' },
  { icon: Gift, label: 'Gift', key: 'gift' },
  { icon: CreditCard, label: 'Payment', key: 'payment' },
  { icon: Building2, label: 'Bank', key: 'bank' },
  { icon: Package, label: 'Package', key: 'package' },
  { icon: Coffee, label: 'Coffee', key: 'coffee' },
  { icon: Pizza, label: 'Pizza', key: 'pizza' },
  { icon: Bus, label: 'Transport', key: 'transport' },
  { icon: Briefcase, label: 'Work', key: 'work' },
  { icon: Heart, label: 'Charity', key: 'charity' },
  { icon: Music, label: 'Music', key: 'music' },
  { icon: Dumbbell, label: 'Fitness', key: 'fitness' },
];

interface IconPickerProps {
  selectedIcon: string;
  onSelect: (icon: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

function IconPicker({ selectedIcon, onSelect, isOpen, onClose }: IconPickerProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
            Select Icon
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Icon Grid */}
        <div className="p-4 grid grid-cols-6 gap-2 max-h-[60vh] overflow-y-auto">
          {TRANSACTION_ICONS.map(({ icon: Icon, label, key }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelect(key);
                onClose();
              }}
              className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${
                selectedIcon === key
                  ? 'bg-primary-100 dark:bg-primary-600/30 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title={label}
            >
              <Icon className="w-6 h-6" />
            </button>
          ))}
        </div>

        {/* Clear Button */}
        {selectedIcon && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                onSelect('');
                onClose();
              }}
              className="w-full py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Get icon component by key
function getIconByKey(key: string): LucideIcon | null {
  const found = TRANSACTION_ICONS.find((i) => i.key === key);
  return found?.icon || null;
}

interface CurrencySelectModalProps {
  value: string;
  onChange: (value: string) => void;
  currencies: { code: string; name: string; balance?: number }[];
  label: string;
  showBalance?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

function CurrencySelectModal({
  value,
  onChange,
  currencies,
  label,
  showBalance,
  isOpen,
  onClose,
}: CurrencySelectModalProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { t, isRTL } = useLanguage();

  const filteredCurrencies = useMemo(() => {
    if (!search.trim()) return currencies;
    const searchLower = search.toLowerCase().trim();
    return currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(searchLower) ||
        c.name.toLowerCase().includes(searchLower)
    );
  }, [currencies, search]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
            {label}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-700/50">
          <div className="relative">
            <Search
              className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${
                isRTL ? 'right-3' : 'left-3'
              }`}
            />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchCurrency')}
              className={`w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600/50 ${
                isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'
              }`}
            />
          </div>
        </div>

        {/* Currency List */}
        <ul
          className="overflow-y-auto p-2"
          style={{ maxHeight: 'calc(80vh - 180px)' }}
        >
          {filteredCurrencies.length > 0 ? (
            filteredCurrencies.map((currency) => {
              const flag = CURRENCY_FLAGS[currency.code] || '🌍';
              const isSelected = currency.code === value;

              return (
                <li
                  key={currency.code}
                  onClick={() => {
                    onChange(currency.code);
                    onClose();
                    setSearch('');
                  }}
                  className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-all rounded-lg ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-600/20 text-primary-800 dark:text-primary-400'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{flag}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm block">
                      {currency.code}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                      {currency.name}
                    </span>
                  </div>
                  {showBalance && currency.balance !== undefined && (
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {currency.balance.toLocaleString()}
                    </span>
                  )}
                  {isSelected && (
                    <Check className="w-5 h-5 text-primary-600 flex-shrink-0" />
                  )}
                </li>
              );
            })
          ) : (
            <li className="px-3 py-8 text-center text-sm text-slate-500">
              {t('noCurrencyFound')}
            </li>
          )}
        </ul>
      </div>
    </div>,
    document.body
  );
}

export function TransactionForm() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currencies } = useCurrencies();

  // Fetch user's balances
  const { data: balancesData } = useQuery({
    queryKey: ['wallet-balances'],
    queryFn: api.wallet.getBalances,
  });

  const balances: WalletBalance[] = balancesData?.balances || [];

  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get current balance for selected currency
  const currentBalance = useMemo(() => {
    const balance = balances.find((b) => b.currency === currency);
    return balance?.balance || 0;
  }, [balances, currency]);

  // For debits, filter to only show currencies with balance
  const availableCurrenciesForDebit = useMemo(() => {
    return balances.filter((b) => b.balance > 0).map((b) => b.currency);
  }, [balances]);

  // When switching to debit, set currency to first available balance
  useEffect(() => {
    if (type === 'debit' && availableCurrenciesForDebit.length > 0) {
      if (!availableCurrenciesForDebit.includes(currency)) {
        setCurrency(availableCurrenciesForDebit[0]);
      }
    }
  }, [type, availableCurrenciesForDebit, currency]);

  const mutation = useMutation({
    mutationFn: api.wallet.addTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      navigate('/wallet');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('transactionFailed'));
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError(t('invalidAmount'));
      return;
    }

    // Validate balance for debits
    if (type === 'debit' && numAmount > currentBalance) {
      setError(t('insufficientBalance'));
      return;
    }

    mutation.mutate({
      type,
      currency,
      amount: numAmount,
      icon: icon || undefined,
      description: description || undefined,
    });
  };

  // Prepare currency options
  const currencyOptionsForCredit = useMemo(() => {
    return (
      currencies?.map((c) => ({
        code: c.code,
        name: c.name,
      })) || [{ code: 'USD', name: 'US Dollar' }]
    );
  }, [currencies]);

  const currencyOptionsForDebit = useMemo(() => {
    return balances
      .filter((b) => b.balance > 0)
      .map((b) => {
        const currencyInfo = currencies?.find((c) => c.code === b.currency);
        return {
          code: b.currency,
          name: currencyInfo?.name || b.currency,
          balance: b.balance,
        };
      });
  }, [balances, currencies]);

  const selectedCurrencyInfo = useMemo(() => {
    return currencies?.find((c) => c.code === currency);
  }, [currencies, currency]);

  const SelectedIcon = icon ? getIconByKey(icon) : null;
  const flag = CURRENCY_FLAGS[currency] || '🌍';

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="max-w-lg mx-auto">
          <Card variant="gradient">
            <CardHeader>
              <CardTitle>{t('addTransaction')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && <ErrorMessage>{error}</ErrorMessage>}

                {/* Transaction Type */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('transactionType')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setType('credit')}
                      className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                        type === 'credit'
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <TrendingUp className="w-5 h-5" />
                      {t('credit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('debit')}
                      className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                        type === 'debit'
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <TrendingDown className="w-5 h-5" />
                      {t('debit')}
                    </button>
                  </div>
                </div>

                {/* Currency Select */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('currency')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCurrencyPicker(true)}
                    disabled={type === 'debit' && currencyOptionsForDebit.length === 0}
                    className="w-full flex items-center gap-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-left hover:border-primary-500 dark:hover:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-2xl flex-shrink-0">{flag}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-white">
                        {currency}
                      </span>
                      {selectedCurrencyInfo && (
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                          {selectedCurrencyInfo.name}
                        </span>
                      )}
                    </div>
                    {type === 'debit' && currentBalance > 0 && (
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {currentBalance.toLocaleString()}
                      </span>
                    )}
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  </button>
                  {type === 'debit' && currentBalance > 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('availableBalance')}:{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {currentBalance.toLocaleString()} {currency}
                      </span>
                    </p>
                  )}
                  {type === 'debit' && currencyOptionsForDebit.length === 0 && (
                    <p className="text-sm text-rose-500">{t('noBalanceAvailable')}</p>
                  )}
                </div>

                {/* Icon Picker */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('transactionIcon')} ({t('optional')})
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(true)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600/30 transition-all text-left flex items-center gap-3"
                    disabled={mutation.isPending}
                  >
                    {SelectedIcon ? (
                      <div className="w-10 h-10 flex items-center justify-center bg-primary-100 dark:bg-primary-600/30 rounded-lg">
                        <SelectedIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg">
                        <Package className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                    <span className={SelectedIcon ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}>
                      {SelectedIcon
                        ? TRANSACTION_ICONS.find((i) => i.key === icon)?.label
                        : t('selectIcon')}
                    </span>
                    <ChevronDown className="w-5 h-5 text-slate-400 ml-auto" />
                  </button>
                </div>

                {/* Amount */}
                <Input
                  type="number"
                  label={t('amount')}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                  disabled={mutation.isPending}
                />

                {/* Description */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('description')} ({t('optional')})
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('transactionDescription')}
                    rows={3}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-600/30 focus:border-primary-600 transition-all resize-none"
                    disabled={mutation.isPending}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={() => navigate('/wallet')}
                    disabled={mutation.isPending}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="flex-1"
                    disabled={mutation.isPending || (type === 'debit' && currencyOptionsForDebit.length === 0)}
                  >
                    {mutation.isPending ? t('adding') : t('addTransaction')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </Container>

      {/* Icon Picker Modal */}
      <IconPicker
        selectedIcon={icon}
        onSelect={setIcon}
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
      />

      {/* Currency Picker Modal */}
      <CurrencySelectModal
        value={currency}
        onChange={setCurrency}
        currencies={type === 'debit' ? currencyOptionsForDebit : currencyOptionsForCredit}
        label={t('selectCurrency')}
        showBalance={type === 'debit'}
        isOpen={showCurrencyPicker}
        onClose={() => setShowCurrencyPicker(false)}
      />
    </main>
  );
}
