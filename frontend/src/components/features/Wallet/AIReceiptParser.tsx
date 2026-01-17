import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { Container } from '../../layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { CurrencyBadge } from '../../ui/CurrencyBadge';
import type { ParsedTransaction, AIParseResponse } from '../../../types/wallet';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  let colorClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';

  if (percent < 70) {
    colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }
  if (percent < 50) {
    colorClass = 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
  }

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
      {percent}%
    </span>
  );
}

function ParsedTransactionCard({
  transaction,
  onRemove,
  index,
}: {
  transaction: ParsedTransaction;
  onRemove: () => void;
  index: number;
}) {
  const { t } = useLanguage();
  const isPositive = transaction.type === 'credit';

  return (
    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              isPositive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
            }`}
          >
            {isPositive ? t('credit') : t('debit')}
          </span>
          <CurrencyBadge code={transaction.currency} size="sm" />
          <ConfidenceBadge confidence={transaction.confidence} />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 truncate">
          {transaction.description}
        </p>
      </div>
      <div className="text-right">
        <span
          className={`text-lg font-semibold ${
            isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {isPositive ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
        </span>
      </div>
      <button
        onClick={onRemove}
        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
        aria-label={t('remove')}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function AIReceiptParser() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [parseResult, setParseResult] = useState<AIParseResponse | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const parseMutation = useMutation({
    mutationFn: api.ai.parseReceipt,
    onSuccess: (data) => {
      setParseResult(data);
      setParsedTransactions(data.transactions);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('parseFailed'));
    },
  });

  const applyMutation = useMutation({
    mutationFn: api.ai.applyParsed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      navigate('/wallet');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('applyFailed'));
    },
  });

  const handleParse = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!text.trim()) {
      setError(t('enterReceiptText'));
      return;
    }

    parseMutation.mutate({ text: text.trim() });
  };

  const handleRemoveTransaction = (index: number) => {
    setParsedTransactions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    if (parsedTransactions.length === 0) {
      setError(t('noTransactionsToApply'));
      return;
    }

    applyMutation.mutate({ transactions: parsedTransactions });
  };

  const handleReset = () => {
    setText('');
    setParseResult(null);
    setParsedTransactions([]);
    setError(null);
  };

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Input Card */}
          <Card variant="gradient">
            <CardHeader>
              <CardTitle>{t('aiReceiptParser')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {t('aiParserDescription')}
              </p>
              <form onSubmit={handleParse} className="space-y-4">
                {error && <ErrorMessage>{error}</ErrorMessage>}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('receiptText')}
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('pasteReceiptHere')}
                    rows={8}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all resize-none font-mono text-sm"
                    disabled={parseMutation.isPending}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={() => navigate('/wallet')}
                    disabled={parseMutation.isPending}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="flex-1"
                    disabled={parseMutation.isPending || !text.trim()}
                  >
                    {parseMutation.isPending ? t('parsing') : t('parseReceipt')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Results Card */}
          {parseResult && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t('parsedTransactions')}</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  {t('parseAnother')}
                </Button>
              </CardHeader>
              <CardContent>
                {parsedTransactions.length === 0 ? (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                    {t('allTransactionsRemoved')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {parsedTransactions.map((transaction, index) => (
                      <ParsedTransactionCard
                        key={index}
                        transaction={transaction}
                        onRemove={() => handleRemoveTransaction(index)}
                        index={index}
                      />
                    ))}
                  </div>
                )}

                {parsedTransactions.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {parsedTransactions.length} {t('transactionsFound')}
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onClick={handleApply}
                      disabled={applyMutation.isPending}
                    >
                      {applyMutation.isPending ? t('applying') : t('applyToWallet')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </Container>
    </main>
  );
}
