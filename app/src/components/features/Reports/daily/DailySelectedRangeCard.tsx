import { Pressable, Text, View } from 'react-native';
import { useTheme } from 'styled-components/native';
import { StyledCategoryIcon } from '../../../../constants/icons';
import { formatCompactCurrency, getTransactionCurrency } from '../../../../utils/format';
import { useLanguage } from '../../../../context/LanguageContext';
import { createReportDateFormatter } from '../reportUX';
import type { ChartBucket, NormalizedTransaction } from './types';

interface DailySelectedRangeCardProps {
  t: (key: string) => string;
  selectedBucket: ChartBucket | null;
  selectedBucketRange: string;
  selectedTransactions: NormalizedTransaction[];
  reportCurrency: string;
  reportTimeZone: string;
  onViewTransactions?: () => void;
}

function renderTransactionAmount(
  transaction: NormalizedTransaction,
  reportCurrency: string
): string {
  const { transaction: tx, amountInReportCurrency } = transaction;

  if (amountInReportCurrency !== null) {
    return formatCompactCurrency(amountInReportCurrency, reportCurrency);
  }

  return formatCompactCurrency(tx.to_amount ?? tx.amount, getTransactionCurrency(tx));
}

export function DailySelectedRangeCard({
  t,
  selectedBucket,
  selectedBucketRange,
  selectedTransactions,
  reportCurrency,
  reportTimeZone,
  onViewTransactions,
}: DailySelectedRangeCardProps) {
  const { language } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const dateFormatter = createReportDateFormatter(
    language,
    { month: 'short', day: 'numeric', year: 'numeric' },
    reportTimeZone
  );

  return (
    <View style={{ backgroundColor: colors.card, padding: 20, borderRadius: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('selectedRange')}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{selectedBucketRange}</Text>
      </View>

      {selectedBucket ? (
        <>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 12 }}>
            {selectedBucket.txCount} {t('transactionsCount')}
          </Text>

          <View style={{ backgroundColor: colors.secondary + '59', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('totalIncome')}</Text>
              <Text style={{ color: colors.success, fontFamily: 'Inter_600SemiBold' }}>{formatCompactCurrency(selectedBucket.income, reportCurrency)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('totalExpenses')}</Text>
              <Text style={{ color: colors.danger, fontFamily: 'Inter_600SemiBold' }}>{formatCompactCurrency(selectedBucket.expenses, reportCurrency)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border + '99' }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('net')}</Text>
              <Text style={{ fontFamily: 'Inter_700Bold', color: selectedBucket.net >= 0 ? colors.success : colors.danger }}>
                {selectedBucket.net >= 0 ? '+' : ''}
                {formatCompactCurrency(selectedBucket.net, reportCurrency)}
              </Text>
            </View>
          </View>

          {selectedBucket.excludedCount > 0 ? (
            <Text style={{ color: colors.accent, fontSize: 12, marginBottom: 12 }}>
              {`${t('excludedFromTotalsNotice')}: ${selectedBucket.excludedCount}`}
            </Text>
          ) : null}

          {selectedTransactions.length > 0 ? (
            <View style={{ gap: 8 }}>
              {selectedTransactions.map((item) => {
                const tx = item.transaction;
                return (
                  <View key={tx.id} style={{ borderRadius: 8, borderWidth: 1, borderColor: colors.border + '99', backgroundColor: colors.secondary + '33', padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingEnd: 12 }}>
                      <StyledCategoryIcon
                        category={tx.category || 'other'}
                        size={12}
                        backgroundOpacity={0.1}
                        borderRadius={4}
                        padding={4}
                      />
                      <View style={{ marginStart: 8, flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_500Medium' }} numberOfLines={1}>
                          {tx.description || tx.category || t('transactions')}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>
                          {dateFormatter.format(new Date(tx.created_at))}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: tx.type === 'credit' ? colors.success : colors.danger }}>
                      {tx.type === 'credit' ? '+' : '-'}
                      {renderTransactionAmount(item, reportCurrency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t('noActivity')}</Text>
          )}

          {onViewTransactions ? (
            <Pressable
              onPress={onViewTransactions}
              style={({ pressed }) => ({
                marginTop: 16,
                backgroundColor: colors.accent,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={t('viewTransactions') || 'View transactions'}
            >
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold' }}>
                {t('viewTransactions') || 'View transactions'}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t('noDataAvailable')}</Text>
      )}
    </View>
  );
}
