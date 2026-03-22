import React, { useState } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import styled from 'styled-components/native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, TrendingUp, Wallet, DollarSign, Gift, Percent } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { cryptoApi, DeFiOverview } from '@/src/api/crypto';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { formatCurrency } from '@/src/utils/format';

const Container = styled.View<{ $bg: string }>`
  flex: 1;
  background-color: ${(props) => props.$bg};
`;

const Header = styled.View<{ $pt: number; $borderColor: string }>`
  flex-direction: row;
  align-items: center;
  padding: 16px;
  padding-top: ${(props) => props.$pt + 16}px;
  border-bottom-width: 1px;
  border-bottom-color: ${(props) => props.$borderColor};
`;

const BackButton = styled.TouchableOpacity`
  padding: 8px;
  margin-right: 8px;
`;

const HeaderTitle = styled.Text<{ $color: string }>`
  font-size: 20px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const Content = styled.ScrollView`
  flex: 1;
  padding: 16px;
`;

const StatsGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
`;

const StatCard = styled.View<{ $bg: string }>`
  flex: 1;
  min-width: 45%;
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: 16px;
`;

const StatIcon = styled.View<{ $bg: string }>`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
  margin-bottom: 8px;
`;

const StatLabel = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(props) => props.$color};
  margin-bottom: 4px;
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
  margin-bottom: 12px;
  margin-top: 8px;
`;

const PositionCard = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
`;

const PositionHeader = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 12px;
`;

const ProtocolIcon = styled.View<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
  margin-right: 12px;
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
  gap: 16px;
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

const HealthWarning = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: #ef444420;
  border-radius: 8px;
  padding: 10px;
  margin-top: 12px;
`;

const WarningText = styled.Text`
  font-size: 12px;
  color: #ef4444;
  margin-left: 8px;
  flex: 1;
`;

const EmptySection = styled.View`
  padding: 40px;
  align-items: center;
`;

const EmptyText = styled.Text<{ $color: string }>`
  font-size: 14px;
  color: ${(props) => props.$color};
  text-align: center;
  margin-top: 12px;
`;

const ProtocolBreakdownCard = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 8px;
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
        <BackButton onPress={() => router.back()}>
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
            <StatIcon $bg="#22c55e20">
              <TrendingUp size={18} color="#22c55e" />
            </StatIcon>
            <StatLabel $color={colors.mutedForeground}>{t('totalSupplied') || 'Total Supplied'}</StatLabel>
            <StatValue $color={colors.foreground}>
              {formatCurrency(overview?.total_supplied_usd ?? 0, 'USD')}
            </StatValue>
          </StatCard>

          <StatCard $bg={colors.card}>
            <StatIcon $bg="#ef444420">
              <DollarSign size={18} color="#ef4444" />
            </StatIcon>
            <StatLabel $color={colors.mutedForeground}>{t('totalBorrowed') || 'Total Borrowed'}</StatLabel>
            <StatValue $color={colors.foreground}>
              {formatCurrency(overview?.total_borrowed_usd ?? 0, 'USD')}
            </StatValue>
          </StatCard>

          <StatCard $bg={colors.card}>
            <StatIcon $bg="#8b5cf620">
              <Gift size={18} color="#8b5cf6" />
            </StatIcon>
            <StatLabel $color={colors.mutedForeground}>{t('totalRewards') || 'Total Rewards'}</StatLabel>
            <StatValue $color={colors.foreground}>
              {formatCurrency(overview?.total_rewards_usd ?? 0, 'USD')}
            </StatValue>
          </StatCard>

          <StatCard $bg={colors.card}>
            <StatIcon $bg={colors.primary + '20'}>
              <Percent size={18} color={colors.primary} />
            </StatIcon>
            <StatLabel $color={colors.mutedForeground}>{t('avgAPY') || 'Avg APY'}</StatLabel>
            <StatValue $color={colors.foreground}>
              {(overview?.avg_apy ?? 0).toFixed(2)}%
            </StatValue>
          </StatCard>
        </StatsGrid>

        {/* Net Worth */}
        <StatCard $bg={colors.card} style={{ marginBottom: 20 }}>
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
                  <ProtocolIcon $bg={colors.primary + '20'}>
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
          <EmptySection>
            <Wallet size={48} color={colors.mutedForeground} />
            <EmptyText $color={colors.mutedForeground}>
              {t('noDefiPositionsDesc') || 'Your lending, staking, and liquidity positions will appear here.'}
            </EmptyText>
          </EmptySection>
        ) : (
          overview?.positions.map((position) => (
            <PositionCard key={position.id} $bg={colors.card}>
              <PositionHeader>
                <ProtocolIcon $bg={colors.primary + '20'}>
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
                  <DetailValue $color="#22c55e">{position.apy.toFixed(2)}%</DetailValue>
                </DetailItem>
              </PositionDetails>

              {position.health_factor && position.health_factor < 1.5 && (
                <HealthWarning>
                  <AlertTriangle size={16} color="#ef4444" />
                  <WarningText>
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
