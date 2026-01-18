import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { useCurrencies } from '../../../hooks';
import { Container } from '../../layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { CurrencyBadge } from '../../ui/CurrencyBadge';
import { Skeleton } from '../../ui/Skeleton';
import type { WalletBalance } from '../../../types/wallet';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function WalletConvert() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currencies } = useCurrencies();

  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Get wallet balances to show available amounts
  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ['wallet-balances'],
    queryFn: () => api.wallet.getBalances(),
  });

  // Get conversion rate preview
  const { data: ratePreview, isLoading: rateLoading } = useQuery({
    queryKey: ['convert-preview', fromCurrency, toCurrency, amount],
    queryFn: () =>
      api.convert({
        from: fromCurrency,
        to: toCurrency,
        amount: parseFloat(amount) || 1,
      }),
    enabled: fromCurrency !== toCurrency && parseFloat(amount) > 0,
    staleTime: 30 * 1000,
  });

  const mutation = useMutation({
    mutationFn: api.wallet.convert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      navigate('/wallet');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('conversionFailed'));
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

    if (fromCurrency === toCurrency) {
      setError(t('sameCurrency'));
      return;
    }

    const fromBalance = balances?.balances.find((b: WalletBalance) => b.currency === fromCurrency);
    if (!fromBalance || fromBalance.balance < numAmount) {
      setError(t('insufficientBalance'));
      return;
    }

    mutation.mutate({
      from_currency: fromCurrency,
      to_currency: toCurrency,
      amount: numAmount,
    });
  };

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const currencyOptions =
    currencies?.map((c) => ({
      value: c.code,
      label: `${c.code} - ${c.name}`,
    })) || [{ value: 'USD', label: 'USD - US Dollar' }];

  const fromBalance = balances?.balances.find((b: WalletBalance) => b.currency === fromCurrency);

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="max-w-lg mx-auto">
          <Card variant="gradient">
            <CardHeader>
              <CardTitle>{t('convertCurrency')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <ErrorMessage>{error}</ErrorMessage>}

                {/* From Currency */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t('from')}
                    </label>
                    {balancesLoading ? (
                      <Skeleton className="h-4 w-24" />
                    ) : fromBalance ? (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('available')}: {formatCurrency(fromBalance.balance, fromCurrency)}
                      </span>
                    ) : null}
                  </div>
                  <select
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-600/30 focus:border-primary-600 transition-all"
                  >
                    {currencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSwap}
                    className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    aria-label={t('swapCurrencies')}
                  >
                    <svg
                      className="w-5 h-5 text-slate-600 dark:text-slate-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                      />
                    </svg>
                  </button>
                </div>

                {/* To Currency */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('to')}
                  </label>
                  <select
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-600/30 focus:border-primary-600 transition-all"
                  >
                    {currencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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

                {/* Preview */}
                {parseFloat(amount) > 0 && fromCurrency !== toCurrency && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                      {t('youWillReceive')}
                    </p>
                    {rateLoading ? (
                      <Skeleton className="h-8 w-32" />
                    ) : ratePreview ? (
                      <div className="flex items-center gap-2">
                        <CurrencyBadge code={toCurrency} size="md" />
                        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                          {formatCurrency(ratePreview.result, toCurrency)}
                        </span>
                      </div>
                    ) : null}
                    {ratePreview && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        1 {fromCurrency} = {ratePreview.rate.toFixed(4)} {toCurrency}
                      </p>
                    )}
                  </div>
                )}

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
                    disabled={mutation.isPending || fromCurrency === toCurrency}
                  >
                    {mutation.isPending ? t('converting') : t('convert')}
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
