import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useTheme as useStyledTheme } from 'styled-components/native';
import { CurrencyConverter } from '../../../../src/components/features/CurrencyConverter';

/**
 * Wallet conversion screen — read-only rate viewer scoped to the user's
 * wallet currencies. No commit button: the page exists to show the live rate
 * for currencies the user actually holds. Acting on it (moving funds) lives
 * elsewhere or comes later via a different surface.
 */
export default function WalletConvertScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string; from?: string; to?: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const { spacing, radii, alpha } = styledTheme;

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;
  const iconColor = colors.foreground;
  const initialAmount = typeof params.amount === 'string' ? params.amount : '';
  const initialFromCurrency = typeof params.from === 'string' ? params.from.toUpperCase() : 'USD';
  const initialToCurrency = typeof params.to === 'string' ? params.to.toUpperCase() : 'EUR';

  const [, setConverterState] = useState({
    amount: initialAmount,
    parsedAmount: 0,
    fromCurrency: initialFromCurrency,
    toCurrency: initialToCurrency,
  });

  const { data: balances, isError: isBalancesError, refetch: refetchBalances } = useQuery({
    queryKey: ['wallet', 'balances'],
    queryFn: () => api.wallet.getBalances(),
  });

  const balanceCurrencies = useMemo(
    () => balances?.balances.map((b) => b.currency) || [],
    [balances]
  );

  const availableCurrencies = balanceCurrencies.length > 0 ? balanceCurrencies : ['USD', 'EUR'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, maxWidth: 800, width: '100%', alignSelf: 'center' }}>
        <Pressable
          onPress={() => router.back()}
          style={{ padding: spacing.sm, marginEnd: spacing.sm, cursor: 'pointer' }}
          hitSlop={12}
          accessibilityLabel={t('a11yBack') || 'Back'}
          accessibilityRole="button"
        >
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('convertCurrency')}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: isDesktop ? spacing.xxxl : spacing.xxl,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: bottomPadding,
        }}
      >
        {isBalancesError && (
          <View style={{ backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: alpha(colors.danger, 0.2), padding: spacing.lg, borderRadius: radii.md, marginBottom: spacing.lg }}>
            <Text style={{ color: colors.danger, marginBottom: spacing.sm }}>{t('failedToLoadBalances') || 'Failed to load balances'}</Text>
            <Pressable onPress={() => refetchBalances()} style={{ backgroundColor: alpha(colors.danger, 0.2), paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.sm, alignSelf: 'flex-start', cursor: 'pointer' }}>
              <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium' }}>{t('retry') || 'Retry'}</Text>
            </Pressable>
          </View>
        )}

        {(balances?.balances?.length ?? 0) === 0 && (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, borderRadius: radii.md, marginBottom: spacing.xxl }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', marginBottom: spacing.sm }}>
              {t('noWalletBalances') || 'No wallet balances yet'}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: spacing.md }}>
              {t('noWalletBalancesDescription') || 'Add a transaction to create a wallet balance before converting.'}
            </Text>
            <Link href={'/transaction-create' as any} asChild>
              <Pressable style={{ cursor: 'pointer', backgroundColor: colors.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.sm, alignSelf: 'flex-start' }}>
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>{t('addTransaction') || 'Add Transaction'}</Text>
              </Pressable>
            </Link>
          </View>
        )}

        <CurrencyConverter
          variant="full"
          showQuickSelect={false}
          allowedCurrencyCodes={availableCurrencies}
          initialAmount={initialAmount}
          initialFromCurrency={initialFromCurrency}
          initialToCurrency={initialToCurrency}
          onStateChange={setConverterState}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
