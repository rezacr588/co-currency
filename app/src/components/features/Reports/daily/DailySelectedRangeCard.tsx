import { Text, View } from 'react-native';
import { StyledCategoryIcon } from '../../../../constants/icons';
import { formatCompactCurrency } from '../../../../utils/format';
import { formatDateKey } from '../../../../utils/dateRange';
import type { ChartBucket, NormalizedTransaction } from './types';

interface DailySelectedRangeCardProps {
  t: (key: string) => string;
  selectedBucket: ChartBucket | null;
  selectedBucketRange: string;
  selectedTransactions: NormalizedTransaction[];
  reportCurrency: string;
}

function renderTransactionAmount(
  transaction: NormalizedTransaction,
  reportCurrency: string
): string {
  const { transaction: tx, amountInReportCurrency } = transaction;

  if (amountInReportCurrency !== null) {
    return formatCompactCurrency(amountInReportCurrency, reportCurrency);
  }

  return formatCompactCurrency(tx.to_amount ?? tx.amount, tx.to_currency ?? tx.currency);
}

export function DailySelectedRangeCard({
  t,
  selectedBucket,
  selectedBucketRange,
  selectedTransactions,
  reportCurrency,
}: DailySelectedRangeCardProps) {
  return (
    <View className="bg-card p-5 rounded-xl">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-foreground font-semibold">{t('selectedRange')}</Text>
        <Text className="text-muted-foreground text-xs">{selectedBucketRange}</Text>
      </View>

      {selectedBucket ? (
        <>
          <Text className="text-muted-foreground text-xs mb-3">
            {selectedBucket.txCount} {t('transactionsCount')}
          </Text>

          <View className="bg-secondary/35 border border-border rounded-xl p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-muted-foreground text-xs">{t('totalIncome')}</Text>
              <Text className="text-success font-semibold">{formatCompactCurrency(selectedBucket.income, reportCurrency)}</Text>
            </View>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-muted-foreground text-xs">{t('totalExpenses')}</Text>
              <Text className="text-danger font-semibold">{formatCompactCurrency(selectedBucket.expenses, reportCurrency)}</Text>
            </View>
            <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border/60">
              <Text className="text-muted-foreground text-xs">{t('net')}</Text>
              <Text className={`font-bold ${selectedBucket.net >= 0 ? 'text-success' : 'text-danger'}`}>
                {selectedBucket.net >= 0 ? '+' : ''}
                {formatCompactCurrency(selectedBucket.net, reportCurrency)}
              </Text>
            </View>
          </View>

          {selectedBucket.excludedCount > 0 ? (
            <Text className="text-accent text-xs mb-3">
              {`${t('excludedFromTotalsNotice')}: ${selectedBucket.excludedCount}`}
            </Text>
          ) : null}

          {selectedTransactions.length > 0 ? (
            <View className="gap-2">
              {selectedTransactions.map((item) => {
                const tx = item.transaction;
                return (
                  <View key={tx.id} className="rounded-lg border border-border/60 bg-secondary/20 p-3 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-3">
                      <StyledCategoryIcon
                        category={tx.category || 'other'}
                        size={12}
                        backgroundOpacity={0.1}
                        borderRadius={4}
                        padding={4}
                      />
                      <View className="ml-2 flex-1">
                        <Text className="text-foreground text-xs font-medium" numberOfLines={1}>
                          {tx.description || tx.category || t('transactions')}
                        </Text>
                        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                          {formatDateKey(new Date(tx.created_at))}
                        </Text>
                      </View>
                    </View>
                    <Text className={`text-xs font-semibold ${tx.type === 'credit' ? 'text-success' : 'text-danger'}`}>
                      {tx.type === 'credit' ? '+' : '-'}
                      {renderTransactionAmount(item, reportCurrency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text className="text-muted-foreground text-sm">{t('noActivity')}</Text>
          )}
        </>
      ) : (
        <Text className="text-muted-foreground text-sm">{t('noDataAvailable')}</Text>
      )}
    </View>
  );
}
