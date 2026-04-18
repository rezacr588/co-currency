import React, { useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components/native';
import { Check } from 'lucide-react-native';

import { useTheme } from 'styled-components/native';

import { api } from '@/src/api';
import { SpaceType, CreateSpaceRequest } from '@/src/api/social';
import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';

const Container = styled.View<{ $bg: string }>`
  flex: 1;
  background-color: ${(p) => p.$bg};
`;

const Content = styled.ScrollView`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.lg}px;
`;

const Section = styled.View`
  margin-bottom: ${({ theme }) => theme.spacing.xxl}px;
`;

const SectionTitle = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.$color};
  margin-bottom: ${({ theme }) => theme.spacing.md}px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const InputContainer = styled.View`
  margin-bottom: ${({ theme }) => theme.spacing.lg}px;
`;

const InputLabel = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.$color};
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

const StyledInput = styled.TextInput<{ $bg: string; $color: string; $border: string }>`
  background-color: ${(p) => p.$bg};
  color: ${(p) => p.$color};
  border-radius: ${({ theme }) => theme.radii.md}px;
  padding: 14px ${({ theme }) => theme.spacing.lg}px;
  font-size: 16px;
  border-width: 1px;
  border-color: ${(p) => p.$border};
`;

const TypeGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const TypeCard = styled.TouchableOpacity<{ $bg: string; $selected: boolean; $selectedBg: string }>`
  width: 30%;
  aspect-ratio: 1;
  background-color: ${(p) => (p.$selected ? p.$selectedBg : p.$bg)};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  align-items: center;
  justify-content: center;
  border-width: 2px;
  border-color: ${(p) => (p.$selected ? p.$selectedBg : 'transparent')};
`;

const TypeIcon = styled.Text`
  font-size: 32px;
  margin-bottom: ${({ theme }) => theme.spacing.xs}px;
`;

const TypeName = styled.Text<{ $color: string; $selected: boolean }>`
  font-size: 12px;
  font-weight: ${(p) => (p.$selected ? '700' : '500')};
  color: ${(p) => p.$color};
`;

const CurrencyGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

const CurrencyChip = styled.TouchableOpacity<{ $bg: string; $selected: boolean; $selectedBg: string }>`
  padding: 10px ${({ theme }) => theme.spacing.lg}px;
  border-radius: ${({ theme }) => theme.radii.xl}px;
  background-color: ${(p) => (p.$selected ? p.$selectedBg : p.$bg)};
`;

const CurrencyText = styled.Text<{ $color: string; $selected: boolean }>`
  font-size: 14px;
  font-weight: ${(p) => (p.$selected ? '700' : '500')};
  color: ${({ theme, $color, $selected }) => ($selected ? theme.colors.primaryForeground : $color)};
`;

const ColorGrid = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const ColorCircle = styled.TouchableOpacity<{ $color: string; $selected: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${(p) => p.$color};
  align-items: center;
  justify-content: center;
  border-width: ${(p) => (p.$selected ? '3px' : '0')};
  border-color: ${({ theme }) => theme.colors.primaryForeground};
`;

const Footer = styled.View<{ $bg: string }>`
  padding: ${({ theme }) => theme.spacing.lg}px;
  border-top-width: 1px;
  border-top-color: ${(p) => p.$bg};
`;

const SPACE_TYPES: { type: SpaceType; icon: string; name: string }[] = [
  { type: 'couple', icon: '💑', name: 'Couple' },
  { type: 'family', icon: '👨‍👩‍👧‍👦', name: 'Family' },
  { type: 'roommates', icon: '🏠', name: 'Roommates' },
  { type: 'trip', icon: '✈️', name: 'Trip' },
  { type: 'project', icon: '💼', name: 'Project' },
  { type: 'custom', icon: '⭐', name: 'Custom' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'IRR'];

function useSpaceColors() {
  const theme = useTheme();
  return [
    theme.colors.palette.blue,
    theme.colors.palette.green,
    theme.colors.palette.yellow,
    theme.colors.palette.red,
    theme.colors.palette.purple,
    theme.colors.palette.pink,
    theme.colors.palette.cyan,
    theme.colors.palette.lime,
  ];
}

export default function CreateSpaceScreen() {
  const { t } = useLanguage();
  const colors = useColors();
  const spaceColors = useSpaceColors();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [spaceType, setSpaceType] = useState<SpaceType>('family');
  const [currency, setCurrency] = useState('USD');
  const [color, setColor] = useState(spaceColors[0]);
  
  const createMutation = useMutation({
    mutationFn: (data: CreateSpaceRequest) => api.social.createSpace(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shared-spaces'] });
      router.replace(`/spaces/${data.space.id}` as any);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to create space');
    },
  });
  
  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a space name');
      return;
    }
    
    createMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      type: spaceType,
      currency,
      color,
    });
  };
  
  const getSpaceTypeName = (type: SpaceType) => {
    const key = `spaceTypes.${type}` as const;
    return t(key) || SPACE_TYPES.find((s) => s.type === type)?.name || type;
  };
  
  return (
    <>
      <Stack.Screen
        options={{
          title: t('createSpace') || 'Create Space',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }}
      />
      
      <Container $bg={colors.background}>
        <Content>
          <Section>
            <SectionTitle $color={colors.mutedForeground}>
              {t('spaceType') || 'Space Type'}
            </SectionTitle>
            <TypeGrid>
              {SPACE_TYPES.map((item) => (
                <TypeCard
                  key={item.type}
                  $bg={colors.card}
                  $selected={spaceType === item.type}
                  $selectedBg={colors.primary}
                  onPress={() => setSpaceType(item.type)}
                >
                  <TypeIcon>{item.icon}</TypeIcon>
                  <TypeName
                    $color={spaceType === item.type ? colors.primaryForeground : colors.foreground}
                    $selected={spaceType === item.type}
                  >
                    {getSpaceTypeName(item.type)}
                  </TypeName>
                </TypeCard>
              ))}
            </TypeGrid>
          </Section>
          
          <Section>
            <InputContainer>
              <InputLabel $color={colors.foreground}>
                {t('spaceName') || 'Space Name'}
              </InputLabel>
              <StyledInput
                $bg={colors.card}
                $color={colors.foreground}
                $border={colors.border}
                placeholder={t('spaceName') || 'e.g., Our Apartment'}
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </InputContainer>
            
            <InputContainer>
              <InputLabel $color={colors.foreground}>
                {t('spaceDescription') || 'Description'} ({t('optional') || 'optional'})
              </InputLabel>
              <StyledInput
                $bg={colors.card}
                $color={colors.foreground}
                $border={colors.border}
                placeholder={t('spaceDescription') || 'What is this space for?'}
                placeholderTextColor={colors.mutedForeground}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            </InputContainer>
          </Section>
          
          <Section>
            <SectionTitle $color={colors.mutedForeground}>
              {t('spaceCurrency') || 'Currency'}
            </SectionTitle>
            <CurrencyGrid>
              {CURRENCIES.map((curr) => (
                <CurrencyChip
                  key={curr}
                  $bg={colors.card}
                  $selected={currency === curr}
                  $selectedBg={colors.primary}
                  onPress={() => setCurrency(curr)}
                >
                  <CurrencyText
                    $color={colors.foreground}
                    $selected={currency === curr}
                  >
                    {curr}
                  </CurrencyText>
                </CurrencyChip>
              ))}
            </CurrencyGrid>
          </Section>
          
          <Section>
            <SectionTitle $color={colors.mutedForeground}>
              {t('spaceColor') || 'Color'}
            </SectionTitle>
            <ColorGrid>
              {spaceColors.map((c) => (
                <ColorCircle
                  key={c}
                  $color={c}
                  $selected={color === c}
                  onPress={() => setColor(c)}
                  accessibilityLabel={`${t('spaceColor') || 'Color'} ${c}`}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  {color === c && <Check size={20} color={colors.primaryForeground} />}
                </ColorCircle>
              ))}
            </ColorGrid>
          </Section>
        </Content>
        
        <Footer $bg={colors.border}>
          <Button
            variant="primary"
            onPress={handleCreate}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending
              ? t('loading') || 'Creating...'
              : t('createSpace') || 'Create Space'}
          </Button>
        </Footer>
      </Container>
    </>
  );
}
