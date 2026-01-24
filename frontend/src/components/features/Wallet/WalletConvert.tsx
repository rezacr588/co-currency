import { useState, FormEvent, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useCurrencies, useMutationAction } from '../../../hooks';
import { Container } from '../../layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { Skeleton } from '../../ui/Skeleton';
import type { WalletBalance } from '../../../types/wallet';
import { formatCurrency, formatNumber, formatRate } from '../../../utils/format';
import { CurrencySelect } from '../../ui';
import { SwapButton } from '../Converter/SwapButton';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { CURRENCY_SYMBOLS, CURRENCY_FLAGS } from '../../../utils/constants';

export function WalletConvert() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: currencies } = useCurrencies();

  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState<number>(0);
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
        amount: amount || 1,
      }),
    enabled: fromCurrency !== toCurrency && amount > 0,
    staleTime: 30 * 1000,
  });

  const mutation = useMutationAction(api.wallet.convert, {
    successMessage: t('conversionSuccessful' as any),
    invalidateQueries: [['wallet-summary'], ['wallet-transactions'], ['wallet-balances']],
    onSuccess: () => navigate('/wallet'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amount <= 0) {
      setError(t('invalidAmount'));
      return;
    }

    if (fromCurrency === toCurrency) {
      setError(t('sameCurrency'));
      return;
    }

    const fromBalance = balances?.balances.find((b: WalletBalance) => b.currency === fromCurrency);
    if (!fromBalance || fromBalance.balance < amount) {
      setError(t('insufficientBalance'));
      return;
    }

    mutation.mutate({
      from_currency: fromCurrency,
      to_currency: toCurrency,
      amount: amount,
    });
  };

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const fromBalance = balances?.balances.find((b: WalletBalance) => b.currency === fromCurrency);

  // Determine if we can submit
  const canSubmit = useMemo(() => {
    if (!amount || amount <= 0) return false;
    if (fromCurrency === toCurrency) return false;
    if (mutation.isPending) return false;
    if (fromBalance && fromBalance.balance < amount) return false;
    return true;
  }, [amount, fromCurrency, toCurrency, mutation.isPending, fromBalance]);

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="max-w-lg mx-auto">
          <Card variant="gradient" className="overflow-visible">
            <CardHeader>
              <CardTitle>{t('convertCurrency')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && <ErrorMessage>{error}</ErrorMessage>}

                {/* Converter Box - Minimal Coin Design */}
                <div className="relative">
                  {/* FROM Section - Top Half */}
                  <div className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-3xl p-4 pb-6">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        {t('from')}
                      </span>
                      {balancesLoading ? (
                        <Skeleton className="h-3 w-16" />
                      ) : (
                        <span className={`text-[10px] font-medium ${
                          fromBalance && amount > fromBalance.balance 
                            ? 'text-rose-500' 
                            : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {t('available')}: {formatCurrency(fromBalance?.balance || 0, fromCurrency)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <CurrencyInput
                        value={amount}
                        onChange={setAmount}
                        currencyCode={fromCurrency}
                        currencySymbol={CURRENCY_SYMBOLS[fromCurrency]}
                        placeholder="0.00"
                        className={fromBalance && amount > fromBalance.balance ? 'text-rose-500' : ''}
                      />
                      <CurrencySelect
                        variant="inline"
                        value={fromCurrency}
                        onChange={setFromCurrency}
                        currencies={currencies}
                      />
                    </div>
                  </div>

                  {/* Swap Button - Coin Divider */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                    <SwapButton onClick={handleSwap} />
                  </div>

                  {/* TO Section - Bottom Half */}
                  <div className="relative bg-slate-50 dark:bg-slate-800/50 border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-3xl p-4 pt-6">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {t('to')} ({t('estimated')})
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 min-w-0 py-2 overflow-hidden">
                        {rateLoading && amount > 0 ? (
                          <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        ) : ratePreview && amount > 0 ? (
                          <div className="flex items-baseline gap-1 overflow-hidden">
                            <span className="text-base text-slate-400 flex-shrink-0">
                              {CURRENCY_SYMBOLS[toCurrency] || ''}
                            </span>
                            <span className="text-2xl sm:text-3xl font-semibold text-slate-800 dark:text-white tabular-nums truncate">
                              {formatNumber(ratePreview.result)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-2xl text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </div>
                      <CurrencySelect
                        variant="inline"
                        value={toCurrency}
                        onChange={setToCurrency}
                        currencies={currencies}
                      />
                    </div>
                  </div>
                </div>

                {/* Exchange Rate Info */}
                {ratePreview && amount > 0 && (
                  <div className="flex justify-center">
                    <div className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full text-xs text-slate-600 dark:text-slate-400">
                      {CURRENCY_FLAGS[fromCurrency] && <span>{CURRENCY_FLAGS[fromCurrency]}</span>}
                      <span>1 {fromCurrency}</span>
                      <span>=</span>
                      <span className="font-mono font-medium">{formatRate(ratePreview.rate)}</span>
                      {CURRENCY_FLAGS[toCurrency] && <span>{CURRENCY_FLAGS[toCurrency]}</span>}
                      <span>{toCurrency}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
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
                    className="flex-1 bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600 text-slate-900 font-semibold"
                    disabled={!canSubmit}
                  >
                    {mutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t('converting')}...
                      </span>
                    ) : (
                      t('confirmConversion')
                    )}
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
