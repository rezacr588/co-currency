import { useState, FormEvent, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { useCurrencies, useConvert } from '../../../hooks';
import { Container } from '../../layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { WalletBalance } from '../../../types/wallet';
import { CURRENCY_FLAGS } from '../../../utils/constants';
import { formatNumber } from '../../../utils/format';
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
  ArrowRightLeft,
  Wallet,
} from 'lucide-react';

// Transaction icons organized by category
interface IconItem {
  icon: LucideIcon;
  label: string;
  key: string;
}

interface IconCategory {
  key: string;
  labelKey: string;
  icons: IconItem[];
}

const CATEGORIZED_ICONS: IconCategory[] = [
  {
    key: 'food',
    labelKey: 'categoryFoodDrink',
    icons: [
      { icon: Utensils, label: 'Food', key: 'food' },
      { icon: Coffee, label: 'Coffee', key: 'coffee' },
      { icon: Pizza, label: 'Pizza', key: 'pizza' },
    ],
  },
  {
    key: 'transport',
    labelKey: 'categoryTransport',
    icons: [
      { icon: Car, label: 'Car', key: 'car' },
      { icon: Bus, label: 'Transport', key: 'transport' },
      { icon: Plane, label: 'Travel', key: 'travel' },
    ],
  },
  {
    key: 'shopping',
    labelKey: 'categoryShopping',
    icons: [
      { icon: ShoppingCart, label: 'Shopping', key: 'shopping' },
      { icon: Shirt, label: 'Clothing', key: 'clothing' },
      { icon: Gift, label: 'Gift', key: 'gift' },
      { icon: Package, label: 'Package', key: 'package' },
    ],
  },
  {
    key: 'home',
    labelKey: 'categoryHome',
    icons: [
      { icon: Home, label: 'Home', key: 'home' },
      { icon: Lightbulb, label: 'Utilities', key: 'utilities' },
      { icon: Smartphone, label: 'Phone', key: 'phone' },
    ],
  },
  {
    key: 'health',
    labelKey: 'categoryHealth',
    icons: [
      { icon: Stethoscope, label: 'Health', key: 'health' },
      { icon: Dumbbell, label: 'Fitness', key: 'fitness' },
      { icon: Heart, label: 'Charity', key: 'charity' },
    ],
  },
  {
    key: 'entertainment',
    labelKey: 'categoryEntertainment',
    icons: [
      { icon: Film, label: 'Entertainment', key: 'entertainment' },
      { icon: Gamepad2, label: 'Gaming', key: 'gaming' },
      { icon: Music, label: 'Music', key: 'music' },
      { icon: GraduationCap, label: 'Education', key: 'education' },
    ],
  },
  {
    key: 'finance',
    labelKey: 'categoryFinance',
    icons: [
      { icon: Banknote, label: 'Money', key: 'money' },
      { icon: CreditCard, label: 'Payment', key: 'payment' },
      { icon: Building2, label: 'Bank', key: 'bank' },
      { icon: Briefcase, label: 'Work', key: 'work' },
    ],
  },
];

// Flat list for searching and lookup
const TRANSACTION_ICONS: IconItem[] = CATEGORIZED_ICONS.flatMap(cat => cat.icons);

interface IconPickerProps {
  selectedIcon: string;
  onSelect: (icon: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

function IconPicker({ selectedIcon, onSelect, isOpen, onClose }: IconPickerProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const isSearching = search.trim().length > 0;

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return TRANSACTION_ICONS;
    const searchLower = search.toLowerCase().trim();
    return TRANSACTION_ICONS.filter(
      (icon) =>
        icon.label.toLowerCase().includes(searchLower) ||
        icon.key.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIZED_ICONS;
    const searchLower = search.toLowerCase().trim();
    return CATEGORIZED_ICONS.map(category => ({
      ...category,
      icons: category.icons.filter(
        icon =>
          icon.label.toLowerCase().includes(searchLower) ||
          icon.key.toLowerCase().includes(searchLower)
      ),
    })).filter(category => category.icons.length > 0);
  }, [search]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
            {t('selectIcon')}
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchIcon')}
              className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 pl-10 pr-3 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600/50"
            />
          </div>
        </div>

        {/* Categorized Icons */}
        <div className="max-h-[55vh] overflow-y-auto">
          {isSearching ? (
            // Flat search results
            <div className="p-4">
              {filteredIcons.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {filteredIcons.map(({ icon: Icon, label, key }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        onSelect(key);
                        onClose();
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all ${
                        selectedIcon === key
                          ? 'bg-primary-100 dark:bg-primary-600/30 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-xs font-medium truncate w-full text-center">
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-500">
                  {t('noIconsFound')}
                </div>
              )}
            </div>
          ) : (
            // Categorized view
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredCategories.map((category) => (
                <div key={category.key} className="p-4">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    {t(category.labelKey as keyof typeof t)}
                  </h4>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {category.icons.map(({ icon: Icon, label, key }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          onSelect(key);
                          onClose();
                        }}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all ${
                          selectedIcon === key
                            ? 'bg-primary-100 dark:bg-primary-600/30 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-xs font-medium truncate w-full text-center">
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
              {t('clearIcon')}
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
                      {formatNumber(currency.balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
  const { data: balancesData, isLoading: isLoadingBalances } = useQuery({
    queryKey: ['wallet-balances'],
    queryFn: api.wallet.getBalances,
  });

  // Ensure balances are properly typed as numbers (API might return strings for NUMERIC fields)
  const balances: WalletBalance[] = useMemo(() => {
    const rawBalances = balancesData?.balances || [];
    return rawBalances.map((b) => ({
      ...b,
      balance: typeof b.balance === 'string' ? parseFloat(b.balance) : b.balance,
    }));
  }, [balancesData]);

  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [currency, setCurrency] = useState('TRY'); // Transaction currency (what you pay/receive in)
  const [walletCurrency, setWalletCurrency] = useState('USD'); // Wallet currency (which balance to use)
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showWalletCurrencyPicker, setShowWalletCurrencyPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if cross-currency transaction
  const isCrossCurrency = currency !== walletCurrency;

  // Get conversion rate when currencies differ
  const numAmount = parseFloat(amount.replace(',', '.')) || 0;
  const { data: conversionData, isLoading: isLoadingConversion } = useConvert(
    isCrossCurrency && numAmount > 0 ? currency : '',
    isCrossCurrency && numAmount > 0 ? walletCurrency : '',
    isCrossCurrency && numAmount > 0 ? numAmount : 0
  );

  // Get current balance for selected wallet currency
  const currentBalance = useMemo(() => {
    const balance = balances.find((b) => b.currency === walletCurrency);
    return balance?.balance || 0;
  }, [balances, walletCurrency]);

  // For debits, filter to only show currencies with balance
  const availableCurrenciesForDebit = useMemo(() => {
    return balances.filter((b) => b.balance > 0).map((b) => b.currency);
  }, [balances]);

  // When switching to debit, set wallet currency to first available balance
  useEffect(() => {
    if (type === 'debit' && availableCurrenciesForDebit.length > 0) {
      if (!availableCurrenciesForDebit.includes(walletCurrency)) {
        setWalletCurrency(availableCurrenciesForDebit[0]);
      }
    }
  }, [type, availableCurrenciesForDebit, walletCurrency]);

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

    // Prevent submission while balances are still loading
    if (type === 'debit' && isLoadingBalances) {
      setError(t('loading'));
      return;
    }

    // Normalize amount: replace comma with period to handle European locales
    const normalizedAmount = amount.replace(',', '.');
    const parsedAmount = parseFloat(normalizedAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(t('invalidAmount'));
      return;
    }

    // Calculate wallet amount for cross-currency transactions
    const walletAmount = isCrossCurrency && conversionData ? conversionData.result : parsedAmount;

    // Validate balance for debits
    if (type === 'debit' && walletAmount > currentBalance) {
      setError(t('insufficientBalance'));
      return;
    }

    mutation.mutate({
      type,
      currency,
      wallet_currency: isCrossCurrency ? walletCurrency : undefined,
      amount: parsedAmount,
      icon: icon || undefined,
      description: description || undefined,
    });
  };

  // Prepare currency options - all currencies for transaction currency
  const allCurrencyOptions = useMemo(() => {
    return (
      currencies?.map((c) => ({
        code: c.code,
        name: c.name,
      })) || [{ code: 'USD', name: 'US Dollar' }]
    );
  }, [currencies]);

  // Wallet currency options - only currencies with balance for debits
  const walletCurrencyOptions = useMemo(() => {
    if (type === 'credit') {
      // For credits, can add to any currency
      return allCurrencyOptions;
    }
    // For debits, only show currencies with balance
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
  }, [balances, currencies, type, allCurrencyOptions]);

  const selectedCurrencyInfo = useMemo(() => {
    return currencies?.find((c) => c.code === currency);
  }, [currencies, currency]);

  const selectedWalletCurrencyInfo = useMemo(() => {
    return currencies?.find((c) => c.code === walletCurrency);
  }, [currencies, walletCurrency]);

  const SelectedIcon = icon ? getIconByKey(icon) : null;
  const flag = CURRENCY_FLAGS[currency] || '🌍';
  const walletFlag = CURRENCY_FLAGS[walletCurrency] || '🌍';

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

                {/* Transaction Currency - What you're paying/receiving in */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('transactionCurrency')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCurrencyPicker(true)}
                    className="w-full flex items-center gap-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-left hover:border-primary-500 dark:hover:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30 transition-all"
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
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {type === 'debit' ? t('currencyYouPaidIn') : t('currencyYouReceivedIn')}
                  </p>
                </div>

                {/* Wallet Currency - Which balance to use */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    {t('walletCurrency')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowWalletCurrencyPicker(true)}
                    disabled={type === 'debit' && walletCurrencyOptions.length === 0}
                    className="w-full flex items-center gap-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-left hover:border-primary-500 dark:hover:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-2xl flex-shrink-0">{walletFlag}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-white">
                        {walletCurrency}
                      </span>
                      {selectedWalletCurrencyInfo && (
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                          {selectedWalletCurrencyInfo.name}
                        </span>
                      )}
                    </div>
                    {currentBalance > 0 && (
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {formatNumber(currentBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  </button>
                  {currentBalance > 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('availableBalance')}:{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {formatNumber(currentBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {walletCurrency}
                      </span>
                    </p>
                  )}
                  {type === 'debit' && walletCurrencyOptions.length === 0 && (
                    <p className="text-sm text-rose-500">{t('noBalanceAvailable')}</p>
                  )}
                </div>

                {/* Conversion Preview */}
                {isCrossCurrency && numAmount > 0 && (
                  <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/20 border border-primary-200 dark:border-primary-800 rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300 mb-2">
                      <ArrowRightLeft className="w-4 h-4" />
                      <span className="font-medium">{t('conversionPreview')}</span>
                    </div>
                    {isLoadingConversion ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('loading')}...
                      </div>
                    ) : conversionData ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">
                            {formatNumber(numAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-white">
                            ≈ {formatNumber(conversionData.result, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {walletCurrency}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {t('rate')}: 1 {currency} = {formatNumber(conversionData.rate, { maximumFractionDigits: 6 })} {walletCurrency}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

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
                    disabled={mutation.isPending || (type === 'debit' && walletCurrencyOptions.length === 0) || (isCrossCurrency && isLoadingConversion)}
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

      {/* Transaction Currency Picker Modal */}
      <CurrencySelectModal
        value={currency}
        onChange={setCurrency}
        currencies={allCurrencyOptions}
        label={t('selectTransactionCurrency')}
        showBalance={false}
        isOpen={showCurrencyPicker}
        onClose={() => setShowCurrencyPicker(false)}
      />

      {/* Wallet Currency Picker Modal */}
      <CurrencySelectModal
        value={walletCurrency}
        onChange={setWalletCurrency}
        currencies={walletCurrencyOptions}
        label={t('selectWalletCurrency')}
        showBalance={type === 'debit'}
        isOpen={showWalletCurrencyPicker}
        onClose={() => setShowWalletCurrencyPicker(false)}
      />
    </main>
  );
}
