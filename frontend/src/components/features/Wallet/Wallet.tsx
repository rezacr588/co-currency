import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { Container } from '../../layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { CurrencyBadge } from '../../ui/CurrencyBadge';
import { TransactionHistory } from './TransactionHistory';
import { formatCurrency } from '../../../utils/format';

function BalanceCard({ currency, amount }: { currency: string; amount: number }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
      <div className="flex items-center gap-3">
        <CurrencyBadge code={currency} size="lg" />
        <div>
          <span className="text-sm text-slate-500 dark:text-slate-400">{currency}</span>
        </div>
      </div>
      <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">
        {formatCurrency(amount, currency)}
      </span>
    </div>
  );
}

export function Wallet() {
  const { t } = useLanguage();

  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['wallet-summary'],
    queryFn: () => api.wallet.getSummary(),
    staleTime: 30 * 1000, // 30 seconds
  });

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="space-y-6">
          {/* Welcome and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {t('wallet')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">{t('walletOverview')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/wallet/add">
                <Button variant="primary" size="sm">
                  {t('addTransaction')}
                </Button>
              </Link>
              <Link to="/wallet/convert">
                <Button variant="secondary" size="sm">
                  {t('convertCurrency')}
                </Button>
              </Link>
              <Link to="/wallet/history">
                <Button variant="ghost" size="sm">
                  {t('transactionHistory')}
                </Button>
              </Link>
              <Link to="/wallet/ai">
                <Button variant="ghost" size="sm">
                  {t('aiParser')}
                </Button>
              </Link>
            </div>
          </div>

          {/* Total Balance */}
          <Card variant="gradient">
            <CardContent className="py-6">
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  {t('totalBalance')}
                </p>
                {isLoading ? (
                  <Skeleton className="h-10 w-48 mx-auto" />
                ) : error ? (
                  <ErrorMessage onRetry={refetch}>{t('failedToLoadWallet')}</ErrorMessage>
                ) : (
                  <p className="text-4xl font-bold bg-gradient-to-r from-primary-700 to-primary-700 dark:from-primary-500 dark:to-primary-500 bg-clip-text text-transparent">
                    {formatCurrency(summary?.total_balance_usd || 0, 'USD')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Balances */}
            <Card>
              <CardHeader>
                <CardTitle>{t('balances')}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : error ? (
                  <ErrorMessage onRetry={refetch}>{t('failedToLoadWallet')}</ErrorMessage>
                ) : summary?.balances && summary.balances.length > 0 ? (
                  <div className="space-y-3">
                    {summary.balances.map((balance) => (
                      <BalanceCard
                        key={balance.currency}
                        currency={balance.currency}
                        amount={balance.balance}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                    {t('noBalances')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t('recentTransactions')}</CardTitle>
                <Link to="/wallet/history">
                  <Button variant="ghost" size="sm">
                    {t('viewAll')}
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : error ? (
                  <ErrorMessage onRetry={refetch}>{t('failedToLoadWallet')}</ErrorMessage>
                ) : summary?.recent_transactions && summary.recent_transactions.length > 0 ? (
                  <TransactionHistory
                    transactions={summary.recent_transactions}
                    showPagination={false}
                  />
                ) : (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                    {t('noTransactions')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </main>
  );
}
