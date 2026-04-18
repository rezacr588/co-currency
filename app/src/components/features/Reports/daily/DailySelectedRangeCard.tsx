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
    <View style={{ backgroundColor: colors.card, padding: theme.spacing.xl, borderRadius: theme.radii.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('selectedRange')}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{selectedBucketRange}</Text>
      </View>

      {selectedBucket ? (
        <>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.md }}>
            {selectedBucket.txCount} {t('transactionsCount')}
          </Text>

          <View style={{ backgroundColor: theme.alpha(colors.secondary, 0.35), borderWidth: 1, borderColor: colors.border, borderRadius: theme.radii.md, padding: theme.spacing.lg, marginBottom: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('totalIncome')}</Text>
              <Text style={{ color: colors.success, fontFamily: 'Inter_600SemiBold' }}>{formatCompactCurrency(selectedBucket.income, reportCurrency)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('totalExpenses')}</Text>
              <Text style={{ color: colors.danger, fontFamily: 'Inter_600SemiBold' }}>{formatCompactCurrency(selectedBucket.expenses, reportCurrency)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.alpha(colors.border, 0.6) }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('net')}</Text>
              <Text style={{ fontFamily: 'Inter_700Bold', color: selectedBucket.net >= 0 ? colors.success : colors.danger }}>
                {selectedBucket.net >= 0 ? '+' : ''}
                {formatCompactCurrency(selectedBucket.net, reportCurrency)}
              </Text>
            </View>
          </View>

          {selectedBucket.excludedCount > 0 ? (
            <Text style={{ color: colors.accent, fontSize: 12, marginBottom: theme.spacing.md }}>
              {`${t('excludedFromTotalsNotice')}: ${selectedBucket.excludedCount}`}
            </Text>
          ) : null}

          {selectedTransactions.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              {selectedTransactions.map((item) => {
                const tx = item.transaction;
                return (
                  <View key={tx.id} style={{ borderRadius: theme.radii.sm, borderWidth: 1, borderColor: theme.alpha(colors.border, 0.6), backgroundColor: theme.alpha(colors.secondary, 0.2), padding: theme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingEnd: theme.spacing.md }}>
                      <StyledCategoryIcon
                        category={tx.category || 'other'}
                        size={12}
                        backgroundOpacity={0.1}
                        borderRadius={4}
                        padding={4}
                      />
                      <View style={{ marginStart: theme.spacing.sm, flex: 1 }}>
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
                marginTop: theme.spacing.lg,
                backgroundColor: colors.accent,
                borderRadius: 10,
                paddingVertical: theme.spacing.md,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={t('viewTransactions') || 'View transactions'}
              accessibilityHint="Open filtered transaction history"
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
