import React, { useState } from 'react';
import { ScrollView, RefreshControl, Alert, Linking } from 'react-native';
import styled from 'styled-components/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Trash2, Copy, ExternalLink, Send, ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/components/ui/Toast';
import { cryptoApi, WalletResponse, CryptoTransaction } from '@/src/api/crypto';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { formatCurrency } from '@/src/utils/format';

const Container = styled.View<{ $bg: string }>`
  flex: 1;
  background-color: ${(props) => props.$bg};
`;

const Header = styled.View<{ $pt: number; $borderColor: string }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  padding-top: ${(props) => props.$pt + 16}px;
  border-bottom-width: 1px;
  border-bottom-color: ${(props) => props.$borderColor};
`;

const HeaderLeft = styled.View`
  flex-direction: row;
  align-items: center;
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

const HeaderActions = styled.View`
  flex-direction: row;
  gap: 8px;
`;

const IconButton = styled.TouchableOpacity<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
`;

const Content = styled.ScrollView`
  flex: 1;
`;

const WalletHeader = styled.View`
  padding: 20px;
  align-items: center;
`;

const NetworkBadge = styled.View<{ $bg: string }>`
  padding: 6px 12px;
  border-radius: 20px;
  background-color: ${(props) => props.$bg};
  margin-bottom: 8px;
`;

const NetworkText = styled.Text<{ $color: string }>`
  font-size: 12px;
  font-weight: 600;
  color: ${(props) => props.$color};
  text-transform: uppercase;
`;

const AddressRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const AddressText = styled.Text<{ $color: string }>`
  font-size: 14px;
  color: ${(props) => props.$color};
  font-family: monospace;
`;

const TotalValue = styled.Text<{ $color: string }>`
  font-size: 36px;
  font-weight: 700;
  color: ${(props) => props.$color};
  margin-top: 16px;
`;

const Section = styled.View`
  padding: 16px;
`;

const SectionHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const SectionTitle = styled.Text<{ $color: string }>`
  font-size: 18px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const TokenCard = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 8px;
  flex-direction: row;
  align-items: center;
`;

const TokenIcon = styled.View<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
  margin-right: 12px;
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
  font-size: 15px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const TokenBalance = styled.Text<{ $color: string }>`
  font-size: 13px;
  color: ${(props) => props.$color};
  margin-top: 2px;
`;

const TokenValueCol = styled.View`
  align-items: flex-end;
`;

const TokenValueText = styled.Text<{ $color: string }>`
  font-size: 15px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const TokenChange = styled.Text<{ $positive: boolean }>`
  font-size: 12px;
  color: ${(props) => (props.$positive ? '#22c55e' : '#ef4444')};
  margin-top: 2px;
`;

const TransactionCard = styled.TouchableOpacity<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 8px;
  flex-direction: row;
  align-items: center;
`;

const TxIcon = styled.View<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
  margin-right: 12px;
`;

const TxInfo = styled.View`
  flex: 1;
`;

const TxType = styled.Text<{ $color: string }>`
  font-size: 15px;
  font-weight: 600;
  color: ${(props) => props.$color};
  text-transform: capitalize;
`;

const TxDate = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(props) => props.$color};
  margin-top: 2px;
`;

const TxAmount = styled.Text<{ $color: string; $type: string }>`
  font-size: 15px;
  font-weight: 600;
  color: ${(props) => (props.$type === 'receive' ? '#22c55e' : props.$type === 'send' ? '#ef4444' : props.$color)};
`;

const EmptySection = styled.View`
  padding: 24px;
  align-items: center;
`;

const EmptyText = styled.Text<{ $color: string }>`
  font-size: 14px;
  color: ${(props) => props.$color};
  text-align: center;
`;

const getExplorerUrl = (network: string, address: string) => {
  const explorers: Record<string, string> = {
    ethereum: `https://etherscan.io/address/${address}`,
    polygon: `https://polygonscan.com/address/${address}`,
    arbitrum: `https://arbiscan.io/address/${address}`,
    optimism: `https://optimistic.etherscan.io/address/${address}`,
    base: `https://basescan.org/address/${address}`,
    bsc: `https://bscscan.com/address/${address}`,
    avalanche: `https://snowtrace.io/address/${address}`,
    solana: `https://solscan.io/account/${address}`,
  };
  return explorers[network] || `https://etherscan.io/address/${address}`;
};

const getTxIcon = (type: string, colors: any) => {
  switch (type) {
    case 'receive':
      return <ArrowDownLeft size={20} color="#22c55e" />;
    case 'send':
      return <ArrowUpRight size={20} color="#ef4444" />;
    case 'swap':
      return <Repeat size={20} color="#8b5cf6" />;
    default:
      return <Send size={20} color={colors.mutedForeground} />;
  }
};

export default function WalletDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);

  const { data: walletData, isLoading, refetch } = useQuery({
    queryKey: ['crypto-wallet', id],
    queryFn: () => cryptoApi.getWallet(id!),
    enabled: !!id,
  });

  const { data: txData } = useQuery({
    queryKey: ['crypto-wallet-transactions', id],
    queryFn: () => cryptoApi.getWalletTransactions(id!, { limit: 10 }),
    enabled: !!id,
  });

  const syncMutation = useMutation({
    mutationFn: () => cryptoApi.syncWallet(id!),
    onSuccess: () => {
      showToast(t('walletSynced') || 'Wallet synced', 'success');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['crypto-portfolio'] });
    },
    onError: () => {
      showToast('Failed to sync wallet', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => cryptoApi.deleteWallet(id!),
    onSuccess: () => {
      showToast('Wallet deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['crypto-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['crypto-portfolio'] });
      router.back();
    },
    onError: () => {
      showToast('Failed to delete wallet', 'error');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const copyAddress = async () => {
    if (walletData?.wallet.address) {
      await Clipboard.setStringAsync(walletData.wallet.address);
      showToast('Address copied', 'success');
    }
  };

  const openExplorer = () => {
    if (walletData?.wallet) {
      const url = getExplorerUrl(walletData.wallet.network, walletData.wallet.address);
      Linking.openURL(url);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      t('deleteWallet') || 'Delete Wallet',
      t('deleteWalletConfirm') || 'Are you sure you want to delete this wallet?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ]
    );
  };

  const shortenAddress = (address: string) => `${address.slice(0, 8)}...${address.slice(-6)}`;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <Container $bg={colors.background}>
        <LoadingSpinner />
      </Container>
    );
  }

  const wallet = walletData?.wallet;
  const balances = walletData?.balances || [];
  const transactions = txData?.transactions || [];

  return (
    <Container $bg={colors.background}>
      <Header $pt={insets.top} $borderColor={colors.border}>
        <HeaderLeft>
          <BackButton onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.foreground} />
          </BackButton>
          <HeaderTitle $color={colors.foreground}>
            {wallet?.label || shortenAddress(wallet?.address || '')}
          </HeaderTitle>
        </HeaderLeft>
        <HeaderActions>
          <IconButton $bg={colors.card} onPress={() => syncMutation.mutate()}>
            <RefreshCw size={18} color={colors.foreground} />
          </IconButton>
          <IconButton $bg="#ef444420" onPress={confirmDelete}>
            <Trash2 size={18} color="#ef4444" />
          </IconButton>
        </HeaderActions>
      </Header>

      <Content
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <WalletHeader>
          <NetworkBadge $bg={colors.primary + '20'}>
            <NetworkText $color={colors.primary}>{wallet?.network}</NetworkText>
          </NetworkBadge>
          <AddressRow onPress={copyAddress}>
            <AddressText $color={colors.mutedForeground}>
              {wallet?.address}
            </AddressText>
            <Copy size={14} color={colors.mutedForeground} />
          </AddressRow>
          <TotalValue $color={colors.foreground}>
            {formatCurrency(walletData?.total_value_usd ?? 0, 'USD')}
          </TotalValue>
          <IconButton $bg={colors.card} onPress={openExplorer} style={{ marginTop: 12 }}>
            <ExternalLink size={18} color={colors.foreground} />
          </IconButton>
        </WalletHeader>

        {/* Token Balances */}
        <Section>
          <SectionHeader>
            <SectionTitle $color={colors.foreground}>{t('tokenBalances') || 'Tokens'}</SectionTitle>
          </SectionHeader>
          {balances.length === 0 ? (
            <EmptySection>
              <EmptyText $color={colors.mutedForeground}>
                {t('noTokensFound') || 'No tokens found in this wallet'}
              </EmptyText>
            </EmptySection>
          ) : (
            balances.map((token) => (
              <TokenCard key={token.id} $bg={colors.card}>
                <TokenIcon $bg={colors.primary + '20'}>
                  <TokenSymbol $color={colors.primary}>
                    {token.token_symbol.substring(0, 3)}
                  </TokenSymbol>
                </TokenIcon>
                <TokenInfo>
                  <TokenName $color={colors.foreground}>{token.token_name}</TokenName>
                  <TokenBalance $color={colors.mutedForeground}>
                    {parseFloat(token.balance).toFixed(6)} {token.token_symbol}
                  </TokenBalance>
                </TokenInfo>
                <TokenValueCol>
                  <TokenValueText $color={colors.foreground}>
                    {formatCurrency(token.balance_usd, 'USD')}
                  </TokenValueText>
                  <TokenChange $positive={token.price_change_24h >= 0}>
                    {token.price_change_24h >= 0 ? '+' : ''}
                    {token.price_change_24h.toFixed(2)}%
                  </TokenChange>
                </TokenValueCol>
              </TokenCard>
            ))
          )}
        </Section>

        {/* Transactions */}
        <Section>
          <SectionHeader>
            <SectionTitle $color={colors.foreground}>{t('cryptoTransactions') || 'Transactions'}</SectionTitle>
          </SectionHeader>
          {transactions.length === 0 ? (
            <EmptySection>
              <EmptyText $color={colors.mutedForeground}>
                No transactions found
              </EmptyText>
            </EmptySection>
          ) : (
            transactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                $bg={colors.card}
                onPress={() => Linking.openURL(getExplorerUrl(wallet?.network || 'ethereum', tx.tx_hash))}
              >
                <TxIcon $bg={tx.tx_type === 'receive' ? '#22c55e20' : tx.tx_type === 'send' ? '#ef444420' : colors.card}>
                  {getTxIcon(tx.tx_type, colors)}
                </TxIcon>
                <TxInfo>
                  <TxType $color={colors.foreground}>{tx.tx_type}</TxType>
                  <TxDate $color={colors.mutedForeground}>{formatDate(tx.timestamp)}</TxDate>
                </TxInfo>
                <TxAmount $color={colors.foreground} $type={tx.tx_type}>
                  {tx.tx_type === 'receive' ? '+' : tx.tx_type === 'send' ? '-' : ''}
                  {parseFloat(tx.amount).toFixed(4)} {tx.token_symbol}
                </TxAmount>
              </TransactionCard>
            ))
          )}
        </Section>
      </Content>
    </Container>
  );
}
