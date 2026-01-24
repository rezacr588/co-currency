import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { Container } from '../../layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { TransactionHistory } from './TransactionHistory';
import { FileUp, Download, Loader2 } from 'lucide-react';
import { TransactionRequest } from '../../../types/wallet';

const PAGE_SIZE = 20;

export function TransactionHistoryPage() {
  const { t } = useLanguage();
  const [offset, setOffset] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['wallet-transactions', offset],
    queryFn: () => api.wallet.getTransactions(PAGE_SIZE, offset),
    staleTime: 30 * 1000,
  });

  const importMutation = useMutation({
    mutationFn: (transactions: TransactionRequest[]) => api.wallet.importTransactions(transactions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      setIsImporting(false);
    },
    onError: () => {
      setIsImporting(false);
    }
  });

  const handleLoadMore = () => {
    setOffset((prev) => prev + PAGE_SIZE);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const transactions: TransactionRequest[] = [];

      // Basic CSV parsing (assuming Header: Date,Type,Amount,Currency,Category,Description)
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length >= 4) {
          transactions.push({
            type: (parts[1].toLowerCase().includes('credit') ? 'credit' : 'debit') as 'credit' | 'debit',
            amount: parseFloat(parts[2]) || 0,
            currency: parts[3].trim().toUpperCase() || 'USD',
            category: parts[4]?.trim() || 'other',
            description: parts[5]?.trim() || 'Imported transaction',
          });
        }
      }

      if (transactions.length > 0) {
        importMutation.mutate(transactions);
      } else {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const hasMore = data && data.transactions.length === PAGE_SIZE;

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {t('transactionHistory')}
              </h1>
              <p className="text-sm text-slate-500">{data?.total || 0} transactions total</p>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportCSV}
                accept=".csv"
                className="hidden"
              />
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="gap-2"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                Import CSV
              </Button>
              <a href={api.wallet.exportTransactions('csv')} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-2 text-slate-500">
                  <Download className="w-4 h-4" />
                  {t('export')}
                </Button>
              </a>
            </div>
          </div>

          <Card>
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <CardTitle>{t('allTransactions')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {isLoading ? (
                <div className="space-y-3 p-6">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="p-6">
                  <ErrorMessage onRetry={refetch}>{t('failedToLoadTransactions')}</ErrorMessage>
                </div>
              ) : data ? (
                <TransactionHistory
                  transactions={data.transactions}
                  showPagination
                  onLoadMore={handleLoadMore}
                  hasMore={hasMore}
                  isLoadingMore={isFetching && offset > 0}
                  showActions
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
