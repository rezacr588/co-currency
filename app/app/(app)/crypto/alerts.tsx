import React, { useState } from 'react';
import { ScrollView, RefreshControl, Alert, Modal } from 'react-native';
import styled from 'styled-components/native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Bell, BellOff, Trash2, TrendingUp, TrendingDown, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/components/ui/Toast';
import { cryptoApi, CryptoAlert, CreateAlertRequest, BlockchainNetwork } from '@/src/api/crypto';
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

const AddButton = styled.TouchableOpacity<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
`;

const Content = styled.ScrollView`
  flex: 1;
  padding: 16px;
`;

const AlertCard = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
`;

const AlertHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const AlertToken = styled.View`
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

const AlertInfo = styled.View``;

const AlertSymbol = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const AlertNetwork = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(props) => props.$color};
  text-transform: uppercase;
`;

const AlertActions = styled.View`
  flex-direction: row;
  gap: 8px;
`;

const IconButton = styled.TouchableOpacity<{ $bg: string }>`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
`;

const AlertCondition = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const ConditionBadge = styled.View<{ $bg: string }>`
  flex-direction: row;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: ${(props) => props.$bg};
`;

const ConditionText = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
  margin-left: 6px;
`;

const TargetValue = styled.Text<{ $color: string }>`
  font-size: 18px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const StatusBadge = styled.View<{ $active: boolean }>`
  padding: 4px 8px;
  border-radius: 4px;
  background-color: ${(props) => (props.$active ? '#22c55e20' : '#6b728020')};
  margin-top: 8px;
  align-self: flex-start;
`;

const StatusText = styled.Text<{ $active: boolean }>`
  font-size: 11px;
  font-weight: 600;
  color: ${(props) => (props.$active ? '#22c55e' : '#6b7280')};
  text-transform: uppercase;
`;

const EmptySection = styled.View`
  padding: 60px 20px;
  align-items: center;
`;

const EmptyText = styled.Text<{ $color: string }>`
  font-size: 14px;
  color: ${(props) => props.$color};
  text-align: center;
  margin-top: 16px;
`;

// Modal styles
const ModalOverlay = styled.TouchableOpacity`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: flex-end;
`;

const ModalContent = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 24px;
  padding-bottom: 40px;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
`;

const ModalTitle = styled.Text<{ $color: string }>`
  font-size: 20px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const CloseButton = styled.TouchableOpacity`
  padding: 4px;
`;

const FormGroup = styled.View`
  margin-bottom: 20px;
`;

const Label = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
  margin-bottom: 8px;
`;

const Input = styled.TextInput<{ $bg: string; $color: string; $borderColor: string }>`
  background-color: ${(props) => props.$bg};
  color: ${(props) => props.$color};
  border-width: 1px;
  border-color: ${(props) => props.$borderColor};
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 16px;
`;

const ConditionButtons = styled.View`
  flex-direction: row;
  gap: 12px;
`;

const ConditionButton = styled.TouchableOpacity<{ $bg: string; $selected: boolean; $borderColor: string }>`
  flex: 1;
  background-color: ${(props) => (props.$selected ? props.$borderColor + '20' : props.$bg)};
  border-width: 2px;
  border-color: ${(props) => (props.$selected ? props.$borderColor : 'transparent')};
  border-radius: 12px;
  padding: 16px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const ConditionLabel = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
  margin-left: 8px;
`;

const SubmitButton = styled.TouchableOpacity<{ $bg: string; $disabled: boolean }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: 16px;
  align-items: center;
  opacity: ${(props) => (props.$disabled ? 0.5 : 1)};
`;

const SubmitText = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const networks: BlockchainNetwork[] = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH' },
  { id: 'bsc', name: 'BNB Chain', symbol: 'BNB' },
];

export default function AlertsScreen() {
  const { t } = useLanguage();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [targetValue, setTargetValue] = useState('');

  const { data: alertsData, isLoading, refetch } = useQuery({
    queryKey: ['crypto-alerts'],
    queryFn: () => cryptoApi.listAlerts(),
  });

  const createMutation = useMutation({
    mutationFn: (request: CreateAlertRequest) => cryptoApi.createAlert(request),
    onSuccess: () => {
      showToast('Alert created', 'success');
      queryClient.invalidateQueries({ queryKey: ['crypto-alerts'] });
      setShowModal(false);
      resetForm();
    },
    onError: () => {
      showToast('Failed to create alert', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (alertId: string) => cryptoApi.deleteAlert(alertId),
    onSuccess: () => {
      showToast('Alert deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['crypto-alerts'] });
    },
    onError: () => {
      showToast('Failed to delete alert', 'error');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const resetForm = () => {
    setTokenSymbol('');
    setTokenAddress('');
    setSelectedNetwork('ethereum');
    setCondition('above');
    setTargetValue('');
  };

  const handleCreate = () => {
    if (!tokenSymbol || !targetValue) return;

    createMutation.mutate({
      token_symbol: tokenSymbol.toUpperCase(),
      token_address: tokenAddress || '0x0000000000000000000000000000000000000000',
      network: selectedNetwork,
      condition,
      target_value: parseFloat(targetValue),
    });
  };

  const confirmDelete = (alertId: string) => {
    Alert.alert('Delete Alert', 'Are you sure you want to delete this alert?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(alertId) },
    ]);
  };

  const isFormValid = tokenSymbol.trim() && parseFloat(targetValue) > 0;
  const alerts = alertsData?.alerts || [];

  if (isLoading) {
    return (
      <Container $bg={colors.background}>
        <LoadingSpinner />
      </Container>
    );
  }

  return (
    <Container $bg={colors.background}>
      <Header $pt={insets.top} $borderColor={colors.border}>
        <HeaderLeft>
          <BackButton onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.foreground} />
          </BackButton>
          <HeaderTitle $color={colors.foreground}>{t('priceAlerts') || 'Price Alerts'}</HeaderTitle>
        </HeaderLeft>
        <AddButton $bg={colors.primary} onPress={() => setShowModal(true)}>
          <Plus size={20} color="#fff" />
        </AddButton>
      </Header>

      <Content
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {alerts.length === 0 ? (
          <EmptySection>
            <Bell size={48} color={colors.mutedForeground} />
            <EmptyText $color={colors.mutedForeground}>
              {t('noAlertsDesc') || 'Create alerts to get notified when token prices reach your targets.'}
            </EmptyText>
          </EmptySection>
        ) : (
          alerts.map((alert) => (
            <AlertCard key={alert.id} $bg={colors.card}>
              <AlertHeader>
                <AlertToken>
                  <TokenIcon $bg={colors.primary + '20'}>
                    <TokenSymbol $color={colors.primary}>
                      {alert.token_symbol.substring(0, 3)}
                    </TokenSymbol>
                  </TokenIcon>
                  <AlertInfo>
                    <AlertSymbol $color={colors.foreground}>{alert.token_symbol}</AlertSymbol>
                    <AlertNetwork $color={colors.mutedForeground}>{alert.network}</AlertNetwork>
                  </AlertInfo>
                </AlertToken>
                <AlertActions>
                  <IconButton $bg="#ef444420" onPress={() => confirmDelete(alert.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </IconButton>
                </AlertActions>
              </AlertHeader>

              <AlertCondition>
                <ConditionBadge $bg={alert.condition === 'above' ? '#22c55e20' : '#ef444420'}>
                  {alert.condition === 'above' ? (
                    <TrendingUp size={16} color="#22c55e" />
                  ) : (
                    <TrendingDown size={16} color="#ef4444" />
                  )}
                  <ConditionText $color={alert.condition === 'above' ? '#22c55e' : '#ef4444'}>
                    {alert.condition === 'above' ? t('alertAbove') || 'Above' : t('alertBelow') || 'Below'}
                  </ConditionText>
                </ConditionBadge>
                <TargetValue $color={colors.foreground}>
                  {formatCurrency(alert.target_value, 'USD')}
                </TargetValue>
              </AlertCondition>

              <StatusBadge $active={alert.is_active}>
                <StatusText $active={alert.is_active}>
                  {alert.is_active ? t('alertActive') || 'Active' : t('alertTriggered') || 'Triggered'}
                </StatusText>
              </StatusBadge>
            </AlertCard>
          ))
        )}
      </Content>

      {/* Create Alert Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <ModalOverlay activeOpacity={1} onPress={() => setShowModal(false)}>
          <ModalContent $bg={colors.background} onStartShouldSetResponder={() => true}>
            <ModalHeader>
              <ModalTitle $color={colors.foreground}>{t('createAlert') || 'Create Alert'}</ModalTitle>
              <CloseButton onPress={() => setShowModal(false)}>
                <X size={24} color={colors.mutedForeground} />
              </CloseButton>
            </ModalHeader>

            <FormGroup>
              <Label $color={colors.foreground}>Token Symbol</Label>
              <Input
                $bg={colors.card}
                $color={colors.foreground}
                $borderColor={colors.border}
                placeholder="e.g. ETH, BTC"
                placeholderTextColor={colors.mutedForeground}
                value={tokenSymbol}
                onChangeText={setTokenSymbol}
                autoCapitalize="characters"
              />
            </FormGroup>

            <FormGroup>
              <Label $color={colors.foreground}>Token Address (Optional)</Label>
              <Input
                $bg={colors.card}
                $color={colors.foreground}
                $borderColor={colors.border}
                placeholder="0x..."
                placeholderTextColor={colors.mutedForeground}
                value={tokenAddress}
                onChangeText={setTokenAddress}
                autoCapitalize="none"
              />
            </FormGroup>

            <FormGroup>
              <Label $color={colors.foreground}>{t('alertCondition') || 'Condition'}</Label>
              <ConditionButtons>
                <ConditionButton
                  $bg={colors.card}
                  $selected={condition === 'above'}
                  $borderColor="#22c55e"
                  onPress={() => setCondition('above')}
                >
                  <TrendingUp size={20} color={condition === 'above' ? '#22c55e' : colors.mutedForeground} />
                  <ConditionLabel $color={condition === 'above' ? '#22c55e' : colors.mutedForeground}>
                    Above
                  </ConditionLabel>
                </ConditionButton>
                <ConditionButton
                  $bg={colors.card}
                  $selected={condition === 'below'}
                  $borderColor="#ef4444"
                  onPress={() => setCondition('below')}
                >
                  <TrendingDown size={20} color={condition === 'below' ? '#ef4444' : colors.mutedForeground} />
                  <ConditionLabel $color={condition === 'below' ? '#ef4444' : colors.mutedForeground}>
                    Below
                  </ConditionLabel>
                </ConditionButton>
              </ConditionButtons>
            </FormGroup>

            <FormGroup>
              <Label $color={colors.foreground}>{t('targetPrice') || 'Target Price'} (USD)</Label>
              <Input
                $bg={colors.card}
                $color={colors.foreground}
                $borderColor={colors.border}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                value={targetValue}
                onChangeText={setTargetValue}
                keyboardType="decimal-pad"
              />
            </FormGroup>

            <SubmitButton
              $bg={colors.primary}
              $disabled={!isFormValid || createMutation.isPending}
              onPress={handleCreate}
              disabled={!isFormValid || createMutation.isPending}
            >
              <SubmitText $color="#fff">
                {createMutation.isPending ? 'Creating...' : t('createAlert') || 'Create Alert'}
              </SubmitText>
            </SubmitButton>
          </ModalContent>
        </ModalOverlay>
      </Modal>
    </Container>
  );
}
