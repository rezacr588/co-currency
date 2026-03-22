import React, { useState } from 'react';
import { ScrollView, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import styled from 'styled-components/native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Wallet, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/components/ui/Toast';
import { cryptoApi, AddWalletRequest, BlockchainNetwork } from '@/src/api/crypto';

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

const NetworkGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

const NetworkOption = styled.TouchableOpacity<{ $bg: string; $selected: boolean; $borderColor: string }>`
  background-color: ${(props) => (props.$selected ? props.$borderColor + '20' : props.$bg)};
  border-width: 2px;
  border-color: ${(props) => (props.$selected ? props.$borderColor : 'transparent')};
  border-radius: 12px;
  padding: 12px 16px;
  flex-direction: row;
  align-items: center;
  min-width: 45%;
  flex: 1;
`;

const NetworkIcon = styled.View<{ $bg: string }>`
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
  margin-right: 10px;
`;

const NetworkSymbol = styled.Text<{ $color: string }>`
  font-size: 10px;
  font-weight: 700;
  color: ${(props) => props.$color};
`;

const NetworkInfo = styled.View`
  flex: 1;
`;

const NetworkName = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.$color};
`;

const CheckMark = styled.View<{ $bg: string }>`
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background-color: ${(props) => props.$bg};
  justify-content: center;
  align-items: center;
`;

const PrimaryToggle = styled.TouchableOpacity<{ $bg: string }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: 16px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const ToggleText = styled.Text<{ $color: string }>`
  font-size: 14px;
  color: ${(props) => props.$color};
`;

const ToggleSwitch = styled.View<{ $active: boolean; $bg: string }>`
  width: 48px;
  height: 28px;
  border-radius: 14px;
  background-color: ${(props) => (props.$active ? props.$bg : '#4b5563')};
  padding: 2px;
  justify-content: center;
`;

const ToggleKnob = styled.View<{ $active: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background-color: white;
  align-self: ${(props) => (props.$active ? 'flex-end' : 'flex-start')};
`;

const SubmitButton = styled.TouchableOpacity<{ $bg: string; $disabled: boolean }>`
  background-color: ${(props) => props.$bg};
  border-radius: 12px;
  padding: 16px;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  opacity: ${(props) => (props.$disabled ? 0.5 : 1)};
  margin-top: 16px;
`;

const SubmitText = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${(props) => props.$color};
  margin-left: 8px;
`;

const ErrorText = styled.Text`
  font-size: 12px;
  color: #ef4444;
  margin-top: 4px;
`;

const networks: BlockchainNetwork[] = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH' },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH' },
  { id: 'base', name: 'Base', symbol: 'ETH' },
  { id: 'bsc', name: 'BNB Chain', symbol: 'BNB' },
  { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
];

export default function AddWalletScreen() {
  const { t } = useLanguage();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [address, setAddress] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('ethereum');
  const [label, setLabel] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [errors, setErrors] = useState<{ address?: string; network?: string }>({});

  const addMutation = useMutation({
    mutationFn: (request: AddWalletRequest) => cryptoApi.addWallet(request),
    onSuccess: () => {
      showToast(t('walletSynced') || 'Wallet added successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['crypto-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['crypto-portfolio'] });
      router.back();
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to add wallet', 'error');
    },
  });

  const validateForm = (): boolean => {
    const newErrors: { address?: string; network?: string } = {};

    if (!address.trim()) {
      newErrors.address = 'Wallet address is required';
    } else if (selectedNetwork !== 'solana' && !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      newErrors.address = 'Invalid EVM wallet address';
    } else if (selectedNetwork === 'solana' && !address.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
      newErrors.address = 'Invalid Solana wallet address';
    }

    if (!selectedNetwork) {
      newErrors.network = 'Please select a network';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    addMutation.mutate({
      address: address.trim(),
      network: selectedNetwork,
      label: label.trim() || undefined,
      is_primary: isPrimary,
    });
  };

  const isValid = address.trim().length > 0 && selectedNetwork;

  return (
    <Container $bg={colors.background}>
      <Header $pt={insets.top} $borderColor={colors.border}>
        <BackButton onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.foreground} />
        </BackButton>
        <HeaderTitle $color={colors.foreground}>{t('addWallet') || 'Add Wallet'}</HeaderTitle>
      </Header>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Content contentContainerStyle={{ paddingBottom: 100 }}>
          <FormGroup>
            <Label $color={colors.foreground}>{t('walletAddress') || 'Wallet Address'}</Label>
            <Input
              $bg={colors.card}
              $color={colors.foreground}
              $borderColor={errors.address ? '#ef4444' : colors.border}
              placeholder={t('enterWalletAddress') || 'Enter wallet address (0x...)'}
              placeholderTextColor={colors.mutedForeground}
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                if (errors.address) setErrors({ ...errors, address: undefined });
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.address && <ErrorText>{errors.address}</ErrorText>}
          </FormGroup>

          <FormGroup>
            <Label $color={colors.foreground}>{t('selectNetwork') || 'Select Network'}</Label>
            <NetworkGrid>
              {networks.map((network) => (
                <NetworkOption
                  key={network.id}
                  $bg={colors.card}
                  $selected={selectedNetwork === network.id}
                  $borderColor={colors.primary}
                  onPress={() => setSelectedNetwork(network.id)}
                >
                  <NetworkIcon $bg={colors.primary + '20'}>
                    <NetworkSymbol $color={colors.primary}>{network.symbol}</NetworkSymbol>
                  </NetworkIcon>
                  <NetworkInfo>
                    <NetworkName $color={colors.foreground}>{network.name}</NetworkName>
                  </NetworkInfo>
                  {selectedNetwork === network.id && (
                    <CheckMark $bg={colors.primary}>
                      <Check size={12} color="#fff" />
                    </CheckMark>
                  )}
                </NetworkOption>
              ))}
            </NetworkGrid>
          </FormGroup>

          <FormGroup>
            <Label $color={colors.foreground}>{t('walletLabel') || 'Wallet Label (Optional)'}</Label>
            <Input
              $bg={colors.card}
              $color={colors.foreground}
              $borderColor={colors.border}
              placeholder={t('walletLabelPlaceholder') || 'My main wallet'}
              placeholderTextColor={colors.mutedForeground}
              value={label}
              onChangeText={setLabel}
            />
          </FormGroup>

          <FormGroup>
            <PrimaryToggle $bg={colors.card} onPress={() => setIsPrimary(!isPrimary)}>
              <ToggleText $color={colors.foreground}>{t('setPrimary') || 'Set as primary wallet'}</ToggleText>
              <ToggleSwitch $active={isPrimary} $bg={colors.primary}>
                <ToggleKnob $active={isPrimary} />
              </ToggleSwitch>
            </PrimaryToggle>
          </FormGroup>

          <SubmitButton
            $bg={colors.primary}
            $disabled={!isValid || addMutation.isPending}
            onPress={handleSubmit}
            disabled={!isValid || addMutation.isPending}
          >
            <Wallet size={20} color="#fff" />
            <SubmitText $color="#fff">
              {addMutation.isPending ? 'Adding...' : t('connectWallet') || 'Connect Wallet'}
            </SubmitText>
          </SubmitButton>
        </Content>
      </KeyboardAvoidingView>
    </Container>
  );
}
