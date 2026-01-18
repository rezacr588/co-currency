import { useState, FormEvent, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { useCurrencies } from '../../../hooks';
import { Container } from '../../layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { ErrorMessage } from '../../ui/ErrorMessage';

// Common transaction emoji icons
const TRANSACTION_EMOJIS = [
  { emoji: '🍔', label: 'Food' },
  { emoji: '🛒', label: 'Shopping' },
  { emoji: '💰', label: 'Money' },
  { emoji: '🏠', label: 'Home' },
  { emoji: '🚗', label: 'Car' },
  { emoji: '✈️', label: 'Travel' },
  { emoji: '💊', label: 'Health' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '📱', label: 'Phone' },
  { emoji: '💡', label: 'Utilities' },
  { emoji: '🎬', label: 'Entertainment' },
  { emoji: '📚', label: 'Education' },
  { emoji: '👕', label: 'Clothing' },
  { emoji: '🎁', label: 'Gift' },
  { emoji: '💳', label: 'Payment' },
  { emoji: '🏦', label: 'Bank' },
  { emoji: '📦', label: 'Package' },
  { emoji: '☕', label: 'Coffee' },
  { emoji: '🍕', label: 'Pizza' },
  { emoji: '🚌', label: 'Transport' },
];

interface EmojiPickerProps {
  selectedEmoji: string;
  onSelect: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

function EmojiPicker({ selectedEmoji, onSelect, isOpen, onClose }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className="absolute z-10 mt-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg"
    >
      <div className="grid grid-cols-5 gap-2">
        {TRANSACTION_EMOJIS.map(({ emoji, label }) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
              selectedEmoji === emoji ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500' : ''
            }`}
            title={label}
          >
            {emoji}
          </button>
        ))}
      </div>
      {selectedEmoji && (
        <button
          type="button"
          onClick={() => {
            onSelect('');
            onClose();
          }}
          className="w-full mt-2 py-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export function TransactionForm() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currencies } = useCurrencies();

  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    mutation.mutate({
      type,
      currency,
      amount: numAmount,
      icon: icon || undefined,
      description: description || undefined,
    });
  };

  const currencyOptions = currencies?.map((c) => ({
    value: c.code,
    label: `${c.code} - ${c.name}`,
  })) || [{ value: 'USD', label: 'USD - US Dollar' }];

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="max-w-lg mx-auto">
          <Card variant="gradient">
            <CardHeader>
              <CardTitle>{t('addTransaction')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                      className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                        type === 'credit'
                          ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {t('credit')} (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('debit')}
                      className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                        type === 'debit'
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {t('debit')} (-)
                    </button>
                  </div>
                </div>

                {/* Currency Select */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('currency')}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-600/30 focus:border-primary-600 transition-all"
                  >
                    {currencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Icon Picker */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('transactionIcon')} ({t('optional')})
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-600/30 focus:border-primary-600 transition-all text-left flex items-center gap-3"
                      disabled={mutation.isPending}
                    >
                      {icon ? (
                        <span className="text-2xl">{icon}</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">{t('selectIcon')}</span>
                      )}
                    </button>
                    <EmojiPicker
                      selectedEmoji={icon}
                      onSelect={setIcon}
                      isOpen={showEmojiPicker}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  </div>
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
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? t('adding') : t('addTransaction')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
