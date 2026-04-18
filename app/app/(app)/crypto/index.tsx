import React, { useState, useEffect } from 'react';
import { ScrollView, RefreshControl, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styled, { useTheme } from 'styled-components/native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Plus, RefreshCw, TrendingUp, TrendingDown, ChevronRight, Coins, BarChart3, Bell, AlertTriangle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/components/ui/Toast';
import { cryptoApi, PortfolioSummary, CryptoWallet } from '@/src/api/crypto';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { CryptoDisclaimerModal } from '@/src/components/features/Crypto/CryptoDisclaimerModal';
import { formatCurrency } from '@/src/utils/format';
import { spacing } from '@/src/theme';

const Container = styled.View<{ $bg: string }>`
  flex: 1;
  background-color: ${(props) => props.$bg};
`;

const Header = styled.View<{ $pt: number }>`
  padding: ${spacing.lg}px;
  padding-top: ${(props) => props.$pt + spacing.lg}px;
`;

const HeaderTitle = styled.Text<{ $color: string }>`
  font-size: 28px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const HeaderSubtitle = styled.Text<{ $color: string }>`
  font-size: 14px;
  color: ${(props) => props.$color};
  margin-top: ${spacing.xs}px;
`;

const Content = styled.ScrollView`
  flex: 1;
  padding: 0 ${spacing.lg}px;
`;

const PortfolioCard = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 16px;
  padding: ${spacing.xl}px;
  margin-bottom: ${spacing.lg}px;
`;

const PortfolioValue = styled.Text<{ $color: string }>`
  font-size: 32px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const ChangeRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-top: ${spacing.sm}px;
`;

const ChangeText = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${(props) => props.$color};
  margin-left: ${spacing.xs}px;
`;

const ChangeLabel = styled.Text<{ $color: string }>`
  font-size: 14px;
  color: ${(props) => props.$color};
  margin-left: ${spacing.sm}px;
`;

const SectionTitle = styled.Text<{ $color: string }>`
  font-size: 18px;
  font-weight: 600;
  color: ${(props) => props.$color};
  margin-bottom: ${spacing.md}px;
  margin-top: ${spacing.sm}px;
`;

const QuickActions = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${spacing.md}px;
  margin-bottom: ${spacing.lg}px;
`;

const ActionButton = styled.TouchableOpacity<{ $bg: string }>`
  flex: 1;
  min-width: 45%;
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: ${spacing.lg}px;
  flex-direction: row;
  align-items: center;
`;

const ActionIcon = styled.View<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
  margin-right: ${spacing.md}px;
`;

const ActionText = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const WalletCard = styled.TouchableOpacity<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: ${spacing.lg}px;
  margin-bottom: ${spacing.md}px;
  flex-direction: row;
  align-items: center;
`;

const WalletInfo = styled.View`
  flex: 1;
`;

const WalletLabel = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const WalletAddress = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(props) => props.$color};
  margin-top: 2px;
`;

const WalletNetwork = styled.View<{ $bg: string }>`
  padding: ${spacing.xs}px ${spacing.sm}px;
  border-radius: 6px;
  background-color: ${(props) => props.$bg};
  margin-top: ${spacing.xs}px;
  align-self: flex-start;
`;

const NetworkText = styled.Text<{ $color: string }>`
  font-size: 10px;
  font-weight: 600;
  color: ${(props) => props.$color};
  text-transform: uppercase;
`;

const WalletValue = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const TopHoldingCard = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: ${spacing.md}px;
  margin-bottom: ${spacing.sm}px;
  flex-direction: row;
  align-items: center;
`;

const TokenIcon = styled.View<{ $bg: string }>`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
  margin-right: ${spacing.md}px;
`;

const TokenSymbol = styled.Text<{ $color: string }>`
  font-size: 12px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const TokenInfo = styled.View`
  flex: 1;
`;

const TokenName = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const TokenBalance = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(props) => props.$color};
`;

const TokenValue = styled.View`
  align-items: flex-end;
`;

const TokenValueText = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const TokenChange = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(props) => props.$color};
`;

const EmptyCard = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 16px;
  padding: ${spacing.xxxl}px;
  align-items: center;
  margin-bottom: ${spacing.lg}px;
`;

const AddWalletButton = styled.TouchableOpacity<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: ${spacing.lg}px ${spacing.xxl}px;
  flex-direction: row;
  align-items: center;
  margin-top: ${spacing.lg}px;
`;

const AddWalletText = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${(props) => props.$color};
  margin-left: ${spacing.sm}px;
`;

export default function CryptoPortfolioScreen() {
  const { t } = useLanguage();
  const colors = useColors();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Check if user has accepted disclaimer
  useEffect(() => {
    const checkDisclaimer = async () => {
      const accepted = await AsyncStorage.getItem('crypto_disclaimer_accepted');
      if (!accepted) {
        setShowDisclaimer(true);
      }
    };
    checkDisclaimer();
  }, []);

  const handleAcceptDisclaimer = async () => {
    await AsyncStorage.setItem('crypto_disclaimer_accepted', 'true');
    setShowDisclaimer(false);
  };

  const handleDeclineDisclaimer = () => {
    setShowDisclaimer(false);
    router.back();
  };

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ['crypto-wallets'],
    queryFn: () => cryptoApi.listWallets(),
  });

  const { data: portfolio, isLoading: portfolioLoading, refetch: refetchPortfolio } = useQuery({
    queryKey: ['crypto-portfolio'],
    queryFn: () => cryptoApi.getPortfolioSummary(),
    enabled: (wallets?.wallets?.length ?? 0) > 0,
  });

  const syncMutation = useMutation({
    mutationFn: () => cryptoApi.syncAllWallets(),
    onSuccess: () => {
      showToast(t('walletSynced') || 'Wallets synced', 'success');
      queryClient.invalidateQueries({ queryKey: ['crypto-portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['crypto-wallets'] });
    },
    onError: () => {
      showToast('Failed to sync wallets', 'error');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchPortfolio();
    setRefreshing(false);
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isLoading = walletsLoading || portfolioLoading;
  const hasWallets = (wallets?.wallets?.length ?? 0) > 0;

  return (
    <Container $bg={colors.background}>
      <CryptoDisclaimerModal
        visible={showDisclaimer}
        onAccept={handleAcceptDisclaimer}
        onDecline={handleDeclineDisclaimer}
      />
      
      <Header $pt={insets.top}>
        <HeaderTitle $color={colors.foreground}>{t('cryptoPortfolio') || 'Crypto Portfolio'}</HeaderTitle>
        <HeaderSubtitle $color={colors.mutedForeground}>
          {hasWallets ? `${wallets?.wallets.length} ${t('cryptoWallets') || 'wallets'} connected` : t('noWalletsDesc') || 'Connect your wallets to start tracking'}
        </HeaderSubtitle>
      </Header>

      <Content
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {isLoading ? (
          <LoadingSpinner />
        ) : !hasWallets ? (
          <EmptyCard $bg={colors.card}>
            <Wallet size={48} color={colors.mutedForeground} />
            <SectionTitle $color={colors.foreground} style={{ textAlign: 'center', marginTop: spacing.lg }}>
              {t('noWalletsYet') || 'No wallets connected'}
            </SectionTitle>
            <HeaderSubtitle $color={colors.mutedForeground} style={{ textAlign: 'center' }}>
              {t('noWalletsDesc') || 'Connect your first crypto wallet to start tracking your portfolio.'}
            </HeaderSubtitle>
            <AddWalletButton $bg={colors.primary} onPress={() => router.push('/crypto/add-wallet' as any)}>
              <Plus size={20} color={colors.primaryForeground} />
              <AddWalletText $color={colors.primaryForeground}>{t('addWallet') || 'Add Wallet'}</AddWalletText>
            </AddWalletButton>
          </EmptyCard>
        ) : (
          <>
            {/* Portfolio Summary */}
            <PortfolioCard $bg={colors.card}>
              <HeaderSubtitle $color={colors.mutedForeground}>
                {t('totalPortfolioValue') || 'Total Portfolio Value'}
              </HeaderSubtitle>
              <PortfolioValue $color={colors.foreground}>
                {formatCurrency(portfolio?.total_value_usd ?? 0, 'USD')}
              </PortfolioValue>
              <ChangeRow>
                {(portfolio?.total_change_24h ?? 0) >= 0 ? (
                  <TrendingUp size={20} color={colors.success} />
                ) : (
                  <TrendingDown size={20} color={colors.danger} />
                )}
                <ChangeText $color={(portfolio?.total_change_24h ?? 0) >= 0 ? colors.success : colors.danger}>
                  {(portfolio?.total_change_24h ?? 0) >= 0 ? '+' : ''}
                  {formatCurrency(Math.abs(portfolio?.total_change_24h ?? 0), 'USD')}
                </ChangeText>
                <ChangeLabel $color={colors.mutedForeground}>
                  ({(portfolio?.total_change_24h_percent ?? 0) >= 0 ? '+' : ''}
                  {(portfolio?.total_change_24h_percent ?? 0).toFixed(2)}%)
                </ChangeLabel>
                <ChangeLabel $color={colors.mutedForeground}>{t('portfolioChange24h') || '24h'}</ChangeLabel>
              </ChangeRow>
            </PortfolioCard>

            {/* Quick Actions */}
            <QuickActions>
              <ActionButton $bg={colors.card} onPress={() => router.push('/crypto/add-wallet' as any)}>
                <ActionIcon $bg={theme.alpha(colors.primary, 0.125)}>
                  <Plus size={20} color={colors.primary} />
                </ActionIcon>
                <ActionText $color={colors.foreground}>{t('addWallet') || 'Add Wallet'}</ActionText>
              </ActionButton>
              <ActionButton $bg={colors.card} onPress={() => syncMutation.mutate()}>
                <ActionIcon $bg={theme.alpha(colors.secondary, 0.125)}>
                  <RefreshCw size={20} color={colors.secondary} />
              </ActionIcon>
                <ActionText $color={colors.foreground}>{t('syncWallet') || 'Sync'}</ActionText>
              </ActionButton>
              <ActionButton $bg={colors.card} onPress={() => router.push('/crypto/defi' as any)}>
                <ActionIcon $bg={theme.alpha(colors.palette.purple, 0.125)}>
                  <BarChart3 size={20} color={colors.palette.purple} />
                </ActionIcon>
                <ActionText $color={colors.foreground}>{t('defi') || 'DeFi'}</ActionText>
              </ActionButton>
              <ActionButton $bg={colors.card} onPress={() => router.push('/crypto/alerts' as any)}>
                <ActionIcon $bg={theme.alpha(colors.warning, 0.125)}>
                  <Bell size={20} color={colors.warning} />
                </ActionIcon>
                <ActionText $color={colors.foreground}>{t('priceAlerts') || 'Alerts'}</ActionText>
              </ActionButton>
            </QuickActions>

            {/* Top Holdings */}
            {portfolio?.top_holdings && portfolio.top_holdings.length > 0 && (
              <>
                <SectionTitle $color={colors.foreground}>{t('topHoldings') || 'Top Holdings'}</SectionTitle>
                {portfolio.top_holdings.slice(0, 5).map((token) => (
                  <TopHoldingCard key={token.id} $bg={colors.card}>
                    <TokenIcon $bg={theme.alpha(colors.primary, 0.125)}>
                      <TokenSymbol $color={colors.primary}>
                        {token.token_symbol.substring(0, 3)}
                      </TokenSymbol>
                    </TokenIcon>
                    <TokenInfo>
                      <TokenName $color={colors.foreground}>{token.token_name}</TokenName>
                      <TokenBalance $color={colors.mutedForeground}>
                        {parseFloat(token.balance).toFixed(4)} {token.token_symbol}
                      </TokenBalance>
                    </TokenInfo>
                    <TokenValue>
                      <TokenValueText $color={colors.foreground}>
                        {formatCurrency(token.balance_usd, 'USD')}
                      </TokenValueText>
                      <TokenChange $color={token.price_change_24h >= 0 ? colors.success : colors.danger}>
                        {token.price_change_24h >= 0 ? '+' : ''}
                        {token.price_change_24h.toFixed(2)}%
                      </TokenChange>
                    </TokenValue>
                  </TopHoldingCard>
                ))}
              </>
            )}

            {/* Wallets */}
            <SectionTitle $color={colors.foreground}>{t('cryptoWallets') || 'Wallets'}</SectionTitle>
            {wallets?.wallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                $bg={colors.card}
                onPress={() => router.push(`/crypto/wallet/${wallet.id}` as any)}
              >
                <WalletInfo>
                  <WalletLabel $color={colors.foreground}>
                    {wallet.label || shortenAddress(wallet.address)}
                  </WalletLabel>
                  <WalletAddress $color={colors.mutedForeground}>
                    {shortenAddress(wallet.address)}
                  </WalletAddress>
                  <WalletNetwork $bg={theme.alpha(colors.primary, 0.125)}>
                    <NetworkText $color={colors.primary}>{wallet.network}</NetworkText>
                  </WalletNetwork>
                </WalletInfo>
                <ChevronRight size={20} color={colors.mutedForeground} />
              </WalletCard>
            ))}
          </>
        )}
      </Content>
    </Container>
  );
}
