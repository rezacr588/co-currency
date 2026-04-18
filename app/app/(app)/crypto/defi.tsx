import React, { useState } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import styled, { useTheme } from 'styled-components/native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, TrendingUp, Wallet, DollarSign, Gift, Percent } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { cryptoApi, DeFiOverview } from '@/src/api/crypto';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { formatCurrency } from '@/src/utils/format';
import { spacing } from '@/src/theme';

const Container = styled.View<{ $bg: string }>`
  flex: 1;
  background-color: ${(props) => props.$bg};
`;

const Header = styled.View<{ $pt: number; $borderColor: string }>`
  flex-direction: row;
  align-items: center;
  padding: ${spacing.lg}px;
  padding-top: ${(props) => props.$pt + spacing.lg}px;
  border-bottom-width: 1px;
  border-bottom-color: ${(props) => props.$borderColor};
`;

const BackButton = styled.TouchableOpacity`
  padding: ${spacing.sm}px;
  margin-right: ${spacing.sm}px;
`;

const HeaderTitle = styled.Text<{ $color: string }>`
  font-size: 20px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const Content = styled.ScrollView`
  flex: 1;
  padding: ${spacing.lg}px;
`;

const StatsGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${spacing.md}px;
  margin-bottom: ${spacing.xl}px;
`;

const StatCard = styled.View<{ $bg: string }>`
  flex: 1;
  min-width: 45%;
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: ${spacing.lg}px;
`;

const StatIcon = styled.View<{ $bg: string }>`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
  margin-bottom: ${spacing.sm}px;
`;

const StatLabel = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(props) => props.$color};
  margin-bottom: ${spacing.xs}px;
`;

const StatValue = styled.Text<{ $color: string }>`
  font-size: 18px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const SectionTitle = styled.Text<{ $color: string }>`
  font-size: 18px;
  font-weight: 600;
  color: ${(props) => props.$color};
  margin-bottom: ${spacing.md}px;
  margin-top: ${spacing.sm}px;
`;

const PositionCard = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: ${spacing.lg}px;
  margin-bottom: ${spacing.md}px;
`;

const PositionHeader = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: ${spacing.md}px;
`;

const ProtocolIcon = styled.View<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
  margin-right: ${spacing.md}px;
`;

const ProtocolName = styled.Text<{ $color: string }>`
  font-size: 12px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const PositionInfo = styled.View`
  flex: 1;
`;

const PositionType = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${(props) => props.$color};
  text-transform: capitalize;
`;

const PositionNetwork = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(props) => props.$color};
  text-transform: uppercase;
`;

const PositionDetails = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${spacing.lg}px;
`;

const DetailItem = styled.View``;

const DetailLabel = styled.Text<{ $color: string }>`
  font-size: 11px;
  color: ${(props) => props.$color};
  margin-bottom: 2px;
`;

const DetailValue = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const HealthWarning = styled.View<{ $bg: string }>`
  flex-direction: row;
  align-items: center;
  background-color: ${(props) => props.$bg};
  border-radius: 8px;
  padding: 10px;
  margin-top: ${spacing.md}px;
`;

const WarningText = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(props) => props.$color};
  margin-left: ${spacing.sm}px;
  flex: 1;
`;

const ProtocolBreakdownCard = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: 14px;
  margin-bottom: ${spacing.sm}px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const ProtocolBreakdownInfo = styled.View`
  flex-direction: row;
  align-items: center;
`;

const ProtocolBreakdownName = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const ProtocolBreakdownValue = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

export default function DeFiScreen() {
  const { t } = useLanguage();
  const colors = useColors();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);

  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['crypto-defi'],
    queryFn: () => cryptoApi.getDeFiOverview(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getPositionTypeIcon = (type: string) => {
    const iconColor = colors.primary;
    switch (type) {
      case 'lending':
        return <DollarSign size={18} color={iconColor} />;
      case 'staking':
        return <TrendingUp size={18} color={iconColor} />;
      case 'liquidity':
        return <Wallet size={18} color={iconColor} />;
      default:
        return <Gift size={18} color={iconColor} />;
    }
  };

  if (isLoading) {
    return (
      <Container $bg={colors.background}>
        <LoadingSpinner />
      </Container>
    );
  }

  const hasPositions = (overview?.positions?.length ?? 0) > 0;

  return (
    <Container $bg={colors.background}>
      <Header $pt={insets.top} $borderColor={colors.border}>
        <BackButton
          onPress={() => router.back()}
          accessibilityLabel={t('a11yBack') || 'Back'}
          accessibilityRole="button"
          hitSlop={8}
        >
          <ArrowLeft size={24} color={colors.foreground} />
        </BackButton>
        <HeaderTitle $color={colors.foreground}>{t('defiOverview') || 'DeFi Overview'}</HeaderTitle>
      </Header>

      <Content
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Stats */}
        <StatsGrid>
          <StatCard $bg={colors.card}>
            <StatIcon $bg={theme.alpha(colors.success, 0.125)}>
              <TrendingUp size={18} color={colors.success} />
            </StatIcon>
            <StatLabel $color={colors.mutedForeground}>{t('totalSupplied') || 'Total Supplied'}</StatLabel>
            <StatValue $color={colors.foreground}>
              {formatCurrency(overview?.total_supplied_usd ?? 0, 'USD')}
            </StatValue>
          </StatCard>

          <StatCard $bg={colors.card}>
            <StatIcon $bg={theme.alpha(colors.danger, 0.125)}>
              <DollarSign size={18} color={colors.danger} />
            </StatIcon>
            <StatLabel $color={colors.mutedForeground}>{t('totalBorrowed') || 'Total Borrowed'}</StatLabel>
            <StatValue $color={colors.foreground}>
              {formatCurrency(overview?.total_borrowed_usd ?? 0, 'USD')}
            </StatValue>
          </StatCard>

          <StatCard $bg={colors.card}>
            <StatIcon $bg={theme.alpha(colors.palette.purple, 0.125)}>
              <Gift size={18} color={colors.palette.purple} />
            </StatIcon>
            <StatLabel $color={colors.mutedForeground}>{t('totalRewards') || 'Total Rewards'}</StatLabel>
            <StatValue $color={colors.foreground}>
              {formatCurrency(overview?.total_rewards_usd ?? 0, 'USD')}
            </StatValue>
          </StatCard>

          <StatCard $bg={colors.card}>
            <StatIcon $bg={theme.alpha(colors.primary, 0.125)}>
              <Percent size={18} color={colors.primary} />
            </StatIcon>
            <StatLabel $color={colors.mutedForeground}>{t('avgAPY') || 'Avg APY'}</StatLabel>
            <StatValue $color={colors.foreground}>
              {(overview?.avg_apy ?? 0).toFixed(2)}%
            </StatValue>
          </StatCard>
        </StatsGrid>

        {/* Net Worth */}
        <StatCard $bg={colors.card} style={{ marginBottom: spacing.xl }}>
          <StatLabel $color={colors.mutedForeground}>{t('cryptoNetWorth') || 'Net Worth'}</StatLabel>
          <StatValue $color={colors.foreground} style={{ fontSize: 28 }}>
            {formatCurrency(overview?.net_worth_usd ?? 0, 'USD')}
          </StatValue>
        </StatCard>

        {/* Protocol Breakdown */}
        {overview?.protocol_breakdown && overview.protocol_breakdown.length > 0 && (
          <>
            <SectionTitle $color={colors.foreground}>Protocols</SectionTitle>
            {overview.protocol_breakdown.map((protocol) => (
              <ProtocolBreakdownCard key={protocol.protocol} $bg={colors.card}>
                <ProtocolBreakdownInfo>
                  <ProtocolIcon $bg={theme.alpha(colors.primary, 0.125)}>
                    <ProtocolName $color={colors.primary}>
                      {protocol.protocol.substring(0, 2).toUpperCase()}
                    </ProtocolName>
                  </ProtocolIcon>
                  <ProtocolBreakdownName $color={colors.foreground}>{protocol.protocol}</ProtocolBreakdownName>
                </ProtocolBreakdownInfo>
                <ProtocolBreakdownValue $color={colors.foreground}>
                  {formatCurrency(protocol.value_usd, 'USD')}
                </ProtocolBreakdownValue>
              </ProtocolBreakdownCard>
            ))}
          </>
        )}

        {/* Positions */}
        <SectionTitle $color={colors.foreground}>{t('defiPositions') || 'Positions'}</SectionTitle>
        {!hasPositions ? (
          <EmptyState
            icon={Wallet}
            title={t('emptyNoDefiTitle') || 'No DeFi positions'}
            description={t('emptyNoDefiDesc') || 'Connect a wallet to see your DeFi holdings.'}
          />
        ) : (
          overview?.positions.map((position) => (
            <PositionCard key={position.id} $bg={colors.card}>
              <PositionHeader>
                <ProtocolIcon $bg={theme.alpha(colors.primary, 0.125)}>
                  {getPositionTypeIcon(position.position_type)}
                </ProtocolIcon>
                <PositionInfo>
                  <PositionType $color={colors.foreground}>
                    {position.position_type} - {position.protocol}
                  </PositionType>
                  <PositionNetwork $color={colors.mutedForeground}>{position.network}</PositionNetwork>
                </PositionInfo>
              </PositionHeader>

              <PositionDetails>
                <DetailItem>
                  <DetailLabel $color={colors.mutedForeground}>Token</DetailLabel>
                  <DetailValue $color={colors.foreground}>{position.token_symbol}</DetailValue>
                </DetailItem>
                <DetailItem>
                  <DetailLabel $color={colors.mutedForeground}>Amount</DetailLabel>
                  <DetailValue $color={colors.foreground}>
                    {parseFloat(position.amount).toFixed(4)}
                  </DetailValue>
                </DetailItem>
                <DetailItem>
                  <DetailLabel $color={colors.mutedForeground}>Value</DetailLabel>
                  <DetailValue $color={colors.foreground}>
                    {formatCurrency(position.value_usd, 'USD')}
                  </DetailValue>
                </DetailItem>
                <DetailItem>
                  <DetailLabel $color={colors.mutedForeground}>APY</DetailLabel>
                  <DetailValue $color={colors.success}>{position.apy.toFixed(2)}%</DetailValue>
                </DetailItem>
              </PositionDetails>

              {position.health_factor && position.health_factor < 1.5 && (
                <HealthWarning $bg={theme.alpha(colors.danger, 0.125)}>
                  <AlertTriangle size={16} color={colors.danger} />
                  <WarningText $color={colors.danger}>
                    {t('healthFactorWarning') || 'Low health factor - risk of liquidation'}
                    {' '}({position.health_factor.toFixed(2)})
                  </WarningText>
                </HealthWarning>
              )}
            </PositionCard>
          ))
        )}
      </Content>
    </Container>
  );
}
