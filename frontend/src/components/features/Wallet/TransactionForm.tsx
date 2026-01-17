import { useState, FormEvent } from 'react';
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

export function TransactionForm() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currencies } = useCurrencies();

  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
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
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
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
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
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
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all resize-none"
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
