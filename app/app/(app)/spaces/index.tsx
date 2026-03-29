import React, { useState } from 'react';
import { View, ScrollView, RefreshControl, Alert, Modal, Pressable } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components/native';
import { Users, Mail, Plus, PlusCircle, ChevronRight, LogIn } from 'lucide-react-native';

import { api } from '@/src/api';
import { SharedSpace, SpaceInvite, SpaceType } from '@/src/api/social';
import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Button } from '@/src/components/ui/Button';

const Container = styled.View<{ $bg: string }>`
  flex: 1;
  background-color: ${(p) => p.$bg};
`;

const Header = styled.View<{ $border: string }>`
  padding: 16px;
  border-bottom-width: 1px;
  border-bottom-color: ${(p) => p.$border};
`;

const TabRow = styled.View`
  flex-direction: row;
  gap: 8px;
`;

const Tab = styled.TouchableOpacity<{ $active: boolean; $bg: string; $activeBg: string }>`
  padding: 8px 16px;
  border-radius: 20px;
  background-color: ${(p) => (p.$active ? p.$activeBg : p.$bg)};
`;

const TabText = styled.Text<{ $active: boolean; $color: string; $activeColor: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => (p.$active ? p.$activeColor : p.$color)};
`;

const SpaceCard = styled.TouchableOpacity<{ $bg: string }>`
  background-color: ${(p) => p.$bg};
  border-radius: 16px;
  padding: 16px;
  margin: 8px 16px;
`;

const SpaceHeader = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 12px;
`;

const SpaceIcon = styled.View<{ $color: string }>`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background-color: ${(p) => p.$color}20;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
`;

const SpaceInfo = styled.View`
  flex: 1;
`;

const SpaceName = styled.Text<{ $color: string }>`
  font-size: 18px;
  font-weight: 700;
  color: ${(p) => p.$color};
`;

const SpaceTypeBadge = styled.Text<{ $color: string }>`
  font-size: 13px;
  color: ${(p) => p.$color};
  margin-top: 2px;
`;

const SpaceStats = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-top: 8px;
`;

const StatItem = styled.View`
  align-items: center;
`;

const StatValue = styled.Text<{ $color: string; $isNegative?: boolean }>`
  font-size: 16px;
  font-weight: 700;
  color: ${(p) => (p.$isNegative ? '#ef4444' : p.$color)};
`;

const StatLabel = styled.Text<{ $color: string }>`
  font-size: 11px;
  color: ${(p) => p.$color};
  margin-top: 2px;
`;

const InviteCard = styled.View<{ $bg: string }>`
  background-color: ${(p) => p.$bg};
  border-radius: 12px;
  padding: 16px;
  margin: 8px 16px;
`;

const InviteHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
`;

const InviteInfo = styled.View`
  flex: 1;
`;

const InviteTitle = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.$color};
`;

const InviteSubtitle = styled.Text<{ $color: string }>`
  font-size: 13px;
  color: ${(p) => p.$color};
  margin-top: 4px;
`;

const InviteActions = styled.View`
  flex-direction: row;
  gap: 8px;
  margin-top: 12px;
`;

const FAB = styled.TouchableOpacity<{ $bg: string }>`
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background-color: ${(p) => p.$bg};
  align-items: center;
  justify-content: center;
  shadow-color: #000;
  shadow-offset: 0px 4px;
  shadow-opacity: 0.3;
  shadow-radius: 6px;
  elevation: 8;
`;

const ModalTitle = styled.Text<{ $color: string }>`
  font-size: 20px;
  font-weight: 700;
  color: ${(p) => p.$color};
  text-align: center;
  margin-bottom: 20px;
`;

const OptionButton = styled.TouchableOpacity<{ $bg: string }>`
  flex-direction: row;
  align-items: center;
  background-color: ${(p) => p.$bg};
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
`;

const OptionIcon = styled.View<{ $bg: string }>`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: ${(p) => p.$bg};
  align-items: center;
  justify-content: center;
  margin-right: 12px;
`;

const OptionText = styled.View`
  flex: 1;
`;

const OptionTitle = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.$color};
`;

const OptionDesc = styled.Text<{ $color: string }>`
  font-size: 13px;
  color: ${(p) => p.$color};
  margin-top: 2px;
`;

const InputContainer = styled.View`
  margin-bottom: 16px;
`;

const InputLabel = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.$color};
  margin-bottom: 8px;
`;

const StyledInput = styled.TextInput<{ $bg: string; $color: string; $border: string }>`
  background-color: ${(p) => p.$bg};
  color: ${(p) => p.$color};
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 16px;
  border-width: 1px;
  border-color: ${(p) => p.$border};
`;

const ModalOverlay = styled.Pressable`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: flex-end;
`;

const ModalContent = styled.View<{ $bg: string }>`
  background-color: ${(p) => p.$bg};
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 20px;
  padding-bottom: 40px;
`;

const SPACE_ICONS: Record<SpaceType, string> = {
  couple: '💑',
  family: '👨‍👩‍👧‍👦',
  roommates: '🏠',
  trip: '✈️',
  project: '💼',
  custom: '⭐',
};

export default function SpacesScreen() {
  const { t } = useLanguage();
  const colors = useColors();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'spaces' | 'invites'>('spaces');
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  
  const { data: spacesData, isLoading: spacesLoading, refetch: refetchSpaces } = useQuery({
    queryKey: ['shared-spaces'],
    queryFn: () => api.social.getMySpaces(),
  });
  
  const { data: invitesData, isLoading: invitesLoading, refetch: refetchInvites } = useQuery({
    queryKey: ['space-invites'],
    queryFn: () => api.social.getMyInvites(),
  });
  
  const respondMutation = useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      api.social.respondToInvite(inviteId, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['space-invites'] });
    },
  });
  
  const joinMutation = useMutation({
    mutationFn: (code: string) => api.social.joinByCode(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-spaces'] });
      setShowJoinSheet(false);
      setJoinCode('');
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to join space');
    },
  });
  
  const spaces = spacesData?.spaces || [];
  const invites = invitesData?.invites?.filter((i: SpaceInvite) => i.status === 'pending') || [];
  
  const formatBalance = (balance?: number, currency?: string) => {
    if (balance === undefined) return '—';
    const sign = balance >= 0 ? '+' : '';
    return `${sign}${balance.toFixed(2)} ${currency || ''}`;
  };
  
  const getSpaceTypeName = (type: SpaceType) => {
    const names: Record<SpaceType, string> = {
      couple: t('spaceTypes.couple') || 'Couple',
      family: t('spaceTypes.family') || 'Family',
      roommates: t('spaceTypes.roommates') || 'Roommates',
      trip: t('spaceTypes.trip') || 'Trip',
      project: t('spaceTypes.project') || 'Project',
      custom: t('spaceTypes.custom') || 'Custom',
    };
    return names[type] || type;
  };
  
  const handleRefresh = () => {
    refetchSpaces();
    refetchInvites();
  };
  
  const renderSpace = (space: SharedSpace) => (
    <SpaceCard
      key={space.id}
      $bg={colors.card}
      onPress={() => router.push(`/spaces/${space.id}` as any)}
    >
      <SpaceHeader>
        <SpaceIcon $color={space.color || colors.primary}>
          <Users size={24} color={space.color || colors.primary} />
        </SpaceIcon>
        <SpaceInfo>
          <SpaceName $color={colors.foreground}>{space.name}</SpaceName>
          <SpaceTypeBadge $color={colors.mutedForeground}>
            {SPACE_ICONS[space.type]} {getSpaceTypeName(space.type)} • {space.member_count || 0} {t('spaceMembers') || 'members'}
          </SpaceTypeBadge>
        </SpaceInfo>
      </SpaceHeader>
      <SpaceStats>
        <StatItem>
          <StatValue $color={colors.success}>{space.currency}</StatValue>
          <StatLabel $color={colors.mutedForeground}>{t('spaceCurrency') || 'Currency'}</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue
            $color={colors.foreground}
            $isNegative={(space.your_balance || 0) < 0}
          >
            {formatBalance(space.your_balance, space.currency)}
          </StatValue>
          <StatLabel $color={colors.mutedForeground}>{t('netBalance') || 'Balance'}</StatLabel>
        </StatItem>
      </SpaceStats>
    </SpaceCard>
  );
  
  const renderInvite = (invite: SpaceInvite) => (
    <InviteCard key={invite.id} $bg={colors.card}>
      <InviteHeader>
        <InviteInfo>
          <InviteTitle $color={colors.foreground}>{invite.space_name || 'Space'}</InviteTitle>
          <InviteSubtitle $color={colors.mutedForeground}>
            {t('inviteByEmail') || 'Invited by'} {invite.inviter_name || invite.inviter_id}
          </InviteSubtitle>
        </InviteInfo>
      </InviteHeader>
      <InviteActions>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => respondMutation.mutate({ inviteId: invite.id, accept: false })}
          disabled={respondMutation.isPending}
        >
          {t('declineInvite') || 'Decline'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onPress={() => respondMutation.mutate({ inviteId: invite.id, accept: true })}
          disabled={respondMutation.isPending}
        >
          {t('acceptInvite') || 'Accept'}
        </Button>
      </InviteActions>
    </InviteCard>
  );
  
  const isLoading = activeTab === 'spaces' ? spacesLoading : invitesLoading;
  
  return (
    <>
      <Stack.Screen
        options={{
          title: t('socialSpaces') || 'Shared Spaces',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }}
      />
      
      <Container $bg={colors.background}>
        <Header $border={colors.border}>
          <TabRow>
            <Tab
              $active={activeTab === 'spaces'}
              $bg={colors.card}
              $activeBg={colors.primary}
              onPress={() => setActiveTab('spaces')}
            >
              <TabText
                $active={activeTab === 'spaces'}
                $color={colors.mutedForeground}
                $activeColor="#fff"
              >
                {t('socialSpaces') || 'Spaces'} ({spaces.length})
              </TabText>
            </Tab>
            <Tab
              $active={activeTab === 'invites'}
              $bg={colors.card}
              $activeBg={colors.primary}
              onPress={() => setActiveTab('invites')}
            >
              <TabText
                $active={activeTab === 'invites'}
                $color={colors.mutedForeground}
                $activeColor="#fff"
              >
                {t('pendingInvites') || 'Invites'} ({invites.length})
              </TabText>
            </Tab>
          </TabRow>
        </Header>
        
        {isLoading ? (
          <LoadingSpinner />
        ) : activeTab === 'spaces' ? (
          spaces.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('noSpacesYet') || 'No shared spaces yet'}
              description={t('noSpacesDesc') || 'Create a space to start tracking shared expenses.'}
            />
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 100 }}
              refreshControl={
                <RefreshControl refreshing={false} onRefresh={handleRefresh} />
              }
            >
              {spaces.map(renderSpace)}
            </ScrollView>
          )
        ) : invites.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={t('noPendingInvites') || 'No pending invites'}
            description=""
          />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={handleRefresh} />
            }
          >
            {invites.map(renderInvite)}
          </ScrollView>
        )}
        
        <FAB $bg={colors.primary} onPress={() => setShowActionSheet(true)}>
          <Plus size={28} color="#fff" />
        </FAB>
      </Container>
      
      {/* Action Sheet */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <ModalOverlay onPress={() => setShowActionSheet(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <ModalContent $bg={colors.background}>
              <ModalTitle $color={colors.foreground}>
                {t('socialSpaces') || 'Shared Spaces'}
              </ModalTitle>
              
              <OptionButton
                $bg={colors.card}
                onPress={() => {
                  setShowActionSheet(false);
                  router.push('/spaces/create' as any);
                }}
              >
                <OptionIcon $bg={colors.primary + '20'}>
                  <PlusCircle size={24} color={colors.primary} />
                </OptionIcon>
                <OptionText>
                  <OptionTitle $color={colors.foreground}>
                    {t('createSpace') || 'Create Space'}
                  </OptionTitle>
                  <OptionDesc $color={colors.mutedForeground}>
                    {t('socialSpacesDesc') || 'Start a new shared space'}
                  </OptionDesc>
                </OptionText>
                <ChevronRight size={20} color={colors.mutedForeground} />
              </OptionButton>

              <OptionButton
                $bg={colors.card}
                onPress={() => {
                  setShowActionSheet(false);
                  setShowJoinSheet(true);
                }}
              >
                <OptionIcon $bg={colors.success + '20'}>
                  <LogIn size={24} color={colors.success} />
                </OptionIcon>
                <OptionText>
                  <OptionTitle $color={colors.foreground}>
                    {t('joinByCode') || 'Join by Code'}
                  </OptionTitle>
                  <OptionDesc $color={colors.mutedForeground}>
                    {t('enterInviteCode') || 'Enter an invite code to join'}
                  </OptionDesc>
                </OptionText>
                <ChevronRight size={20} color={colors.mutedForeground} />
              </OptionButton>
            </ModalContent>
          </Pressable>
        </ModalOverlay>
      </Modal>
      
      {/* Join by Code Modal */}
      <Modal
        visible={showJoinSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJoinSheet(false)}
      >
        <ModalOverlay onPress={() => setShowJoinSheet(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <ModalContent $bg={colors.background}>
              <ModalTitle $color={colors.foreground}>
                {t('joinByCode') || 'Join by Code'}
              </ModalTitle>
              
              <InputContainer>
                <InputLabel $color={colors.foreground}>
                  {t('inviteCode') || 'Invite Code'}
                </InputLabel>
                <StyledInput
                  $bg={colors.card}
                  $color={colors.foreground}
                  $border={colors.border}
                  placeholder="ABC123"
                  placeholderTextColor={colors.mutedForeground}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </InputContainer>
              
              <Button
                variant="primary"
                onPress={() => joinMutation.mutate(joinCode)}
                disabled={!joinCode.trim() || joinMutation.isPending}
              >
                {joinMutation.isPending ? t('loading') || 'Joining...' : t('joinSpace') || 'Join Space'}
              </Button>
            </ModalContent>
          </Pressable>
        </ModalOverlay>
      </Modal>
    </>
  );
}
