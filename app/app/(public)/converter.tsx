import { Text, View, useWindowDimensions } from 'react-native';
import { ArrowLeftRight, Globe, Wallet } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../src/context/LanguageContext';
import { CurrencyConverter } from '../../src/components/features/CurrencyConverter';
import { MarketingScaffold, SectionBlock, SurfaceCard } from '../../src/components/ui';

export default function ConverterScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  return (
    <MarketingScaffold>
      <SectionBlock
        title={t('converterTitle')}
        subtitle={t('converterSubtitle')}
      >
        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: theme.spacing.xl, alignItems: 'stretch' }}>
          <SurfaceCard style={{ flex: 1.2, padding: theme.spacing.xxl }}>
            <CurrencyConverter variant="full" showQuickSelect={false} />
          </SurfaceCard>

          <View style={{ flex: 0.8, gap: theme.spacing.md }}>
            <SurfaceCard>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.secondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: theme.spacing.md,
                }}
              >
                <ArrowLeftRight size={22} color={theme.colors.primary} />
              </View>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.h2.fontFamily, fontSize: 18, lineHeight: 24 }}>
                {t('converterTitle')}
              </Text>
              <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
                {t('converterDescription') || 'Convert currencies with a standard, clear form layout that works equally well on mobile and web.'}
              </Text>
            </SurfaceCard>

            <SurfaceCard>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.secondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: theme.spacing.md,
                }}
              >
                <Globe size={22} color={theme.colors.primary} />
              </View>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.h2.fontFamily, fontSize: 18, lineHeight: 24 }}>
                {t('featureGlobal') || 'Global'}
              </Text>
              <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
                {t('converterDesc') || 'Access 160+ currencies from the same shared converter surface.'}
              </Text>
            </SurfaceCard>

            <SurfaceCard>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.secondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: theme.spacing.md,
                }}
              >
                <Wallet size={22} color={theme.colors.primary} />
              </View>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.h2.fontFamily, fontSize: 18, lineHeight: 24 }}>
                {t('wallet')}
              </Text>
              <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
                {t('walletDescription') || 'Move from quick conversion into balances, reports, and transaction tracking without changing tools.'}
              </Text>
            </SurfaceCard>
          </View>
        </View>
      </SectionBlock>
    </MarketingScaffold>
  );
}
