import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { Container } from '../../layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { TransactionHistory } from './TransactionHistory';

const PAGE_SIZE = 20;

export function TransactionHistoryPage() {
  const { t } = useLanguage();
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['wallet-transactions', offset],
    queryFn: () => api.wallet.getTransactions(PAGE_SIZE, offset),
    staleTime: 30 * 1000,
  });

  const handleLoadMore = () => {
    setOffset((prev) => prev + PAGE_SIZE);
  };

  const hasMore = data && data.transactions.length === PAGE_SIZE;

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {t('transactionHistory')}
            </h1>
            <Link to="/wallet">
              <Button variant="ghost" size="sm">
                {t('backToWallet')}
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('allTransactions')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : error ? (
                <ErrorMessage onRetry={refetch}>{t('failedToLoadTransactions')}</ErrorMessage>
              ) : data ? (
                <TransactionHistory
                  transactions={data.transactions}
                  showPagination
                  onLoadMore={handleLoadMore}
                  hasMore={hasMore}
                  isLoadingMore={isFetching && offset > 0}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
