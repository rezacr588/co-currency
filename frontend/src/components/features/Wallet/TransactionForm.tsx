import { useState, FormEvent, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useCurrencies, useConvert, useMutationAction } from '../../../hooks';
import { Container } from '../../layout';
import { Modal, CurrencySelect } from '../../ui';
import { Card, CardContent } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { WalletBalance, TransactionRequest } from '../../../types/wallet';
import { CURRENCY_FLAGS } from '../../../utils/constants';
import { formatNumber } from '../../../utils/format';
import { readJSON, writeJSON } from '../../../utils/storage';
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
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Wallet,
  Star,
  Trash2,
} from 'lucide-react';

interface TransactionTemplate extends TransactionRequest {
  id: string;
  name: string;
}

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('selectIcon')}
      size="lg"
    >
      <div className="space-y-4 -mt-2">
        {/* Search */}
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

        {/* Categorized Icons */}
        <div className="max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
          {isSearching ? (
            // Flat search results
            <div className="py-2">
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
                <div key={category.key} className="py-4 first:pt-0">
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
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onSelect('');
                onClose();
              }}
              className="w-full py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
            >
              {t('clearIcon')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Get icon component by key
function getIconByKey(key: string): LucideIcon | null {
  const found = TRANSACTION_ICONS.find((i) => i.key === key);
  return found?.icon || null;
}

export function TransactionForm() {
  const { t } = useLanguage();
  const navigate = useNavigate();
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

  const [type, setType] = useState<'credit' | 'debit'>('debit');
  const [currency, setCurrency] = useState('USD'); // Transaction currency (what you pay/receive in)
  const [walletCurrency, setWalletCurrency] = useState('USD'); // Wallet currency (which balance to use)
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showWalletCurrencyPicker, setShowWalletCurrencyPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Quick Templates state
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Load templates on mount
  useEffect(() => {
    const savedTemplates = readJSON<TransactionTemplate[]>('transaction_templates');
    if (savedTemplates) {
      setTemplates(savedTemplates);
    }
  }, []);

  const saveTemplates = (newTemplates: TransactionTemplate[]) => {
    setTemplates(newTemplates);
    writeJSON('transaction_templates', newTemplates);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    
    const newTemplate: TransactionTemplate = {
      id: crypto.randomUUID(),
      name: templateName,
      type,
      currency,
      wallet_currency: walletCurrency,
      amount: parseFloat(amount.replace(',', '.')) || 0,
      description,
      icon,
    };
    
    saveTemplates([newTemplate, ...templates]);
    setShowSaveTemplate(false);
    setTemplateName('');
  };

  const applyTemplate = (template: TransactionTemplate) => {
    setType(template.type);
    setCurrency(template.currency);
    setWalletCurrency(template.wallet_currency || template.currency);
    setAmount(template.amount > 0 ? template.amount.toString() : '');
    setDescription(template.description || '');
    setIcon(template.icon || '');
  };

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveTemplates(templates.filter(t => t.id !== id));
  };

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

  const mutation = useMutationAction(api.wallet.addTransaction, {
    successMessage: t('transactionAdded' as any),
    invalidateQueries: [['wallet-summary'], ['wallet-transactions'], ['wallet-balances']],
    onSuccess: () => navigate('/wallet'),
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
      category: icon || undefined, // Use icon key as category (e.g., 'food', 'shopping')
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

  const SelectedIcon = icon ? getIconByKey(icon) : null;
  const flag = CURRENCY_FLAGS[currency] || '🌍';
  const walletFlag = CURRENCY_FLAGS[walletCurrency] || '🌍';

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              {t('addTransaction')}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/wallet')}
              className="text-slate-500"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main Form */}
            <div className="lg:col-span-7">
              <Card variant="default" className="shadow-xl shadow-slate-200/20 dark:shadow-none">
                <CardContent className="p-6">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Transaction Currency */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                          {t('transactionCurrency')}
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCurrencyPicker(true)}
                          className="w-full flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-left hover:border-primary-500 transition-all"
                        >
                          <span className="text-xl">{flag}</span>
                          <span className="font-semibold text-slate-800 dark:text-white flex-1 truncate">
                            {currency}
                          </span>
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>

                      {/* Wallet Currency */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-primary-500" />
                          {t('walletCurrency')}
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowWalletCurrencyPicker(true)}
                          disabled={type === 'debit' && walletCurrencyOptions.length === 0}
                          className="w-full flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-left hover:border-primary-500 transition-all disabled:opacity-50"
                        >
                          <span className="text-xl">{walletFlag}</span>
                          <span className="font-semibold text-slate-800 dark:text-white flex-1 truncate">
                            {walletCurrency}
                          </span>
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>

                    {/* Conversion Preview */}
                    {isCrossCurrency && numAmount > 0 && (
                      <div className="p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/50 rounded-xl">
                        {isLoadingConversion ? (
                          <div className="text-xs text-slate-500 animate-pulse">{t('loading')}...</div>
                        ) : conversionData ? (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">{t('conversionPreview')}</span>
                            <span className="font-semibold text-primary-700 dark:text-primary-400">
                              ≈ {formatNumber(conversionData.result)} {walletCurrency}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Icon */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                          {t('transactionIcon')}
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowIconPicker(true)}
                          className="w-full flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-left hover:border-primary-500 transition-all"
                        >
                          {SelectedIcon ? (
                            <SelectedIcon className="w-5 h-5 text-primary-600" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                          <span className="text-slate-700 dark:text-slate-200 flex-1 truncate">
                            {SelectedIcon ? TRANSACTION_ICONS.find(i => i.key === icon)?.label : t('selectIcon')}
                          </span>
                          <ChevronDown className="w-4 h-4 text-slate-400" />
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
                        className="!mt-0"
                      />
                    </div>

                    {/* Description */}
                    <Input
                      label={t('description')}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('transactionDescription')}
                    />

                    {/* Actions */}
                    <div className="flex flex-col gap-3 pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-full shadow-lg shadow-primary-500/20"
                        disabled={mutation.isPending || (type === 'debit' && walletCurrencyOptions.length === 0) || (isCrossCurrency && isLoadingConversion)}
                      >
                        {mutation.isPending ? t('adding') : t('addTransaction')}
                      </Button>
                      
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-slate-500"
                          onClick={() => setShowSaveTemplate(true)}
                        >
                          <Star className="w-4 h-4 me-2" />
                          Save as Template
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-slate-500"
                          onClick={() => navigate('/wallet')}
                        >
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Side Templates Panel */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  Templates
                </h2>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                  {templates.length}
                </span>
              </div>

              {templates.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {templates.map((template) => {
                    const TemplateIcon = template.icon ? getIconByKey(template.icon) : Star;
                    return (
                      <button
                        key={template.id}
                        onClick={() => applyTemplate(template)}
                        className="group flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary-500 hover:shadow-md transition-all text-left"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          template.type === 'credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {TemplateIcon && <TemplateIcon className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">
                            {template.name}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {template.amount} {template.currency} • {template.description || 'No desc'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteTemplate(template.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  <Star className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-500">No templates yet. Save frequent transactions here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>

      {/* Save Template Modal */}
      <Modal
        isOpen={showSaveTemplate}
        onClose={() => setShowSaveTemplate(false)}
        title="Save Template"
        size="sm"
      >
        <div className="space-y-6">
          <Input
            label="Template Name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g., Daily Coffee, Salary, Rent"
            autoFocus
          />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowSaveTemplate(false)}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Icon Picker Modal */}
      <IconPicker
        selectedIcon={icon}
        onSelect={setIcon}
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
      />

      {/* Transaction Currency Picker Modal */}
      <CurrencySelect
        value={currency}
        onChange={setCurrency}
        currencies={allCurrencyOptions}
        label={t('selectTransactionCurrency')}
        showBalance={false}
        isOpen={showCurrencyPicker}
        onClose={() => setShowCurrencyPicker(false)}
      />

      {/* Wallet Currency Picker Modal */}
      <CurrencySelect
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
