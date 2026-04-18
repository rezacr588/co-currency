import React, { useState } from 'react';
import { ScrollView, RefreshControl, Alert, Modal } from 'react-native';
import styled, { useTheme } from 'styled-components/native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Bell, BellOff, Trash2, TrendingUp, TrendingDown, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/components/ui/Toast';
import { cryptoApi, CryptoAlert, CreateAlertRequest, BlockchainNetwork } from '@/src/api/crypto';
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
  justify-content: space-between;
  padding: ${spacing.lg}px;
  padding-top: ${(props) => props.$pt + spacing.lg}px;
  border-bottom-width: 1px;
  border-bottom-color: ${(props) => props.$borderColor};
`;

const HeaderLeft = styled.View`
  flex-direction: row;
  align-items: center;
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
  padding: ${spacing.lg}px;
`;

const AlertCard = styled.View<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: ${spacing.lg}px;
  margin-bottom: ${spacing.md}px;
`;

const AlertHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${spacing.md}px;
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
  margin-right: ${spacing.md}px;
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
  gap: ${spacing.sm}px;
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
  gap: ${spacing.sm}px;
`;

const ConditionBadge = styled.View<{ $bg: string }>`
  flex-direction: row;
  align-items: center;
  padding: ${spacing.sm}px ${spacing.md}px;
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

const StatusBadge = styled.View<{ $bg: string }>`
  padding: ${spacing.xs}px ${spacing.sm}px;
  border-radius: 4px;
  background-color: ${(props) => props.$bg};
  margin-top: ${spacing.sm}px;
  align-self: flex-start;
`;

const StatusText = styled.Text<{ $color: string }>`
  font-size: 11px;
  font-weight: 600;
  color: ${(props) => props.$color};
  text-transform: uppercase;
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
  padding: ${spacing.xxl}px;
  padding-bottom: 40px;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${spacing.xxl}px;
`;

const ModalTitle = styled.Text<{ $color: string }>`
  font-size: 20px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const CloseButton = styled.TouchableOpacity`
  padding: ${spacing.xs}px;
`;

const FormGroup = styled.View`
  margin-bottom: ${spacing.xl}px;
`;

const Label = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
  margin-bottom: ${spacing.sm}px;
`;

const Input = styled.TextInput<{ $bg: string; $color: string; $borderColor: string }>`
  background-color: ${(props) => props.$bg};
  color: ${(props) => props.$color};
  border-width: 1px;
  border-color: ${(props) => props.$borderColor};
  border-radius: 12px;
  padding: 14px ${spacing.lg}px;
  font-size: 16px;
`;

const ConditionButtons = styled.View`
  flex-direction: row;
  gap: ${spacing.md}px;
`;

const ConditionButton = styled.TouchableOpacity<{ $bg: string; $selected: boolean; $borderColor: string; $selectedBg: string }>`
  flex: 1;
  background-color: ${(props) => (props.$selected ? props.$selectedBg : props.$bg)};
  border-width: 2px;
  border-color: ${(props) => (props.$selected ? props.$borderColor : 'transparent')};
  border-radius: 12px;
  padding: ${spacing.lg}px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const ConditionLabel = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
  margin-left: ${spacing.sm}px;
`;

const SubmitButton = styled.TouchableOpacity<{ $bg: string; $disabled: boolean }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: ${spacing.lg}px;
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
  const theme = useTheme();
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
          <BackButton
            onPress={() => router.back()}
            accessibilityLabel={t('a11yBack') || 'Back'}
            accessibilityRole="button"
            hitSlop={8}
          >
            <ArrowLeft size={24} color={colors.foreground} />
          </BackButton>
          <HeaderTitle $color={colors.foreground}>{t('priceAlerts') || 'Price Alerts'}</HeaderTitle>
        </HeaderLeft>
        <AddButton
          $bg={colors.primary}
          onPress={() => setShowModal(true)}
          accessibilityLabel={t('a11yAdd') || 'Add'}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Plus size={20} color={colors.primaryForeground} />
        </AddButton>
      </Header>

      <Content
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {alerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t('emptyNoAlertsTitle') || 'No price alerts'}
            description={t('emptyNoAlertsDesc') || 'Set an alert to get notified on price movements.'}
            actionLabel={t('emptyNoAlertsCta') || 'Create alert'}
            onAction={() => setShowModal(true)}
          />
        ) : (
          alerts.map((alert) => (
            <AlertCard key={alert.id} $bg={colors.card}>
              <AlertHeader>
                <AlertToken>
                  <TokenIcon $bg={theme.alpha(colors.primary, 0.125)}>
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
                  <IconButton
                    $bg={theme.alpha(colors.danger, 0.125)}
                    onPress={() => confirmDelete(alert.id)}
                    accessibilityLabel={t('a11yDelete') || 'Delete'}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </IconButton>
                </AlertActions>
              </AlertHeader>

              <AlertCondition>
                <ConditionBadge $bg={theme.alpha(alert.condition === 'above' ? colors.success : colors.danger, 0.125)}>
                  {alert.condition === 'above' ? (
                    <TrendingUp size={16} color={colors.success} />
                  ) : (
                    <TrendingDown size={16} color={colors.danger} />
                  )}
                  <ConditionText $color={alert.condition === 'above' ? colors.success : colors.danger}>
                    {alert.condition === 'above' ? t('alertAbove') || 'Above' : t('alertBelow') || 'Below'}
                  </ConditionText>
                </ConditionBadge>
                <TargetValue $color={colors.foreground}>
                  {formatCurrency(alert.target_value, 'USD')}
                </TargetValue>
              </AlertCondition>

              <StatusBadge $bg={theme.alpha(alert.is_active ? colors.success : colors.palette.gray, 0.125)}>
                <StatusText $color={alert.is_active ? colors.success : colors.palette.gray}>
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
              <CloseButton
                onPress={() => setShowModal(false)}
                accessibilityLabel={t('a11yClose') || 'Close'}
                accessibilityRole="button"
                hitSlop={8}
              >
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
                  $borderColor={colors.success}
                  $selectedBg={theme.alpha(colors.success, 0.125)}
                  onPress={() => setCondition('above')}
                >
                  <TrendingUp size={20} color={condition === 'above' ? colors.success : colors.mutedForeground} />
                  <ConditionLabel $color={condition === 'above' ? colors.success : colors.mutedForeground}>
                    Above
                  </ConditionLabel>
                </ConditionButton>
                <ConditionButton
                  $bg={colors.card}
                  $selected={condition === 'below'}
                  $borderColor={colors.danger}
                  $selectedBg={theme.alpha(colors.danger, 0.125)}
                  onPress={() => setCondition('below')}
                >
                  <TrendingDown size={20} color={condition === 'below' ? colors.danger : colors.mutedForeground} />
                  <ConditionLabel $color={condition === 'below' ? colors.danger : colors.mutedForeground}>
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
              <SubmitText $color={colors.primaryForeground}>
                {createMutation.isPending ? 'Creating...' : t('createAlert') || 'Create Alert'}
              </SubmitText>
            </SubmitButton>
          </ModalContent>
        </ModalOverlay>
      </Modal>
    </Container>
  );
}
