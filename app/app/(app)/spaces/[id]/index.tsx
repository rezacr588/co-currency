import React, { useState } from 'react';
import { View, ScrollView, RefreshControl, Alert, Modal, Pressable } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components/native';
import { Receipt, Users, Scale, Settings, UserPlus, ArrowLeftRight, Plus, User } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from 'styled-components/native';

import { api } from '@/src/api';
import { SharedExpense, BalanceSummary, SpaceMember, SuggestedSettlement, SpaceType } from '@/src/api/social';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/components/ui/Toast';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Button } from '@/src/components/ui/Button';

const Container = styled.View<{ $bg: string }>`
  flex: 1;
  background-color: ${(p) => p.$bg};
`;

const Header = styled.View<{ $color: string }>`
  padding: ${({ theme }) => theme.spacing.xl}px ${({ theme }) => theme.spacing.lg}px;
  background-color: ${({ theme, $color }) => theme.alpha($color, 0.08)};
  border-bottom-left-radius: ${({ theme }) => theme.radii.xxl}px;
  border-bottom-right-radius: ${({ theme }) => theme.radii.xxl}px;
`;

const SpaceTitle = styled.Text<{ $color: string }>`
  font-size: 24px;
  font-weight: 700;
  color: ${(p) => p.$color};
  text-align: center;
`;

const SpaceSubtitle = styled.Text<{ $color: string }>`
  font-size: 14px;
  color: ${(p) => p.$color};
  text-align: center;
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

const BalanceCard = styled.View<{ $bg: string }>`
  background-color: ${(p) => p.$bg};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  margin: ${({ theme }) => theme.spacing.lg}px;
  align-items: center;
`;

const BalanceLabel = styled.Text<{ $color: string }>`
  font-size: 13px;
  color: ${(p) => p.$color};
`;

const BalanceValue = styled.Text<{ $color: string; $isNegative?: boolean }>`
  font-size: 32px;
  font-weight: 700;
  color: ${({ theme, $color, $isNegative }) => ($isNegative ? theme.colors.danger : $color)};
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

const TabRow = styled.View`
  flex-direction: row;
  padding: 0 ${({ theme }) => theme.spacing.lg}px;
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

const Tab = styled.TouchableOpacity<{ $active: boolean; $bg: string; $activeBg: string }>`
  flex: 1;
  padding: 10px;
  border-radius: ${({ theme }) => theme.radii.md}px;
  background-color: ${(p) => (p.$active ? p.$activeBg : p.$bg)};
  align-items: center;
`;

const TabText = styled.Text<{ $active: boolean; $color: string }>`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme, $active, $color }) => ($active ? theme.colors.primaryForeground : $color)};
`;

const ExpenseCard = styled.TouchableOpacity<{ $bg: string }>`
  background-color: ${(p) => p.$bg};
  border-radius: ${({ theme }) => theme.radii.md}px;
  padding: 14px;
  margin: 6px ${({ theme }) => theme.spacing.lg}px;
  flex-direction: row;
  align-items: center;
`;

const ExpenseIcon = styled.View<{ $bg: string }>`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: ${(p) => p.$bg};
  align-items: center;
  justify-content: center;
  margin-right: ${({ theme }) => theme.spacing.md}px;
`;

const ExpenseInfo = styled.View`
  flex: 1;
`;

const ExpenseTitle = styled.Text<{ $color: string }>`
  font-size: 15px;
  font-weight: 600;
  color: ${(p) => p.$color};
`;

const ExpenseSubtitle = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(p) => p.$color};
  margin-top: 2px;
`;

const ExpenseAmount = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 700;
  color: ${(p) => p.$color};
`;

const MemberCard = styled.View<{ $bg: string }>`
  background-color: ${(p) => p.$bg};
  border-radius: ${({ theme }) => theme.radii.md}px;
  padding: 14px;
  margin: 6px ${({ theme }) => theme.spacing.lg}px;
  flex-direction: row;
  align-items: center;
`;

const MemberAvatar = styled.View<{ $bg: string }>`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: ${(p) => p.$bg};
  align-items: center;
  justify-content: center;
  margin-right: ${({ theme }) => theme.spacing.md}px;
`;

const MemberInfo = styled.View`
  flex: 1;
`;

const MemberName = styled.Text<{ $color: string }>`
  font-size: 15px;
  font-weight: 600;
  color: ${(p) => p.$color};
`;

const MemberRole = styled.Text<{ $color: string }>`
  font-size: 12px;
  color: ${(p) => p.$color};
  margin-top: 2px;
`;

const MemberBalance = styled.Text<{ $isNegative?: boolean }>`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme, $isNegative }) => ($isNegative ? theme.colors.danger : theme.colors.success)};
`;

const SettlementCard = styled.View<{ $bg: string }>`
  background-color: ${(p) => p.$bg};
  border-radius: ${({ theme }) => theme.radii.md}px;
  padding: 14px;
  margin: 6px ${({ theme }) => theme.spacing.lg}px;
  flex-direction: row;
  align-items: center;
`;

const SettlementInfo = styled.View`
  flex: 1;
`;

const SettlementText = styled.Text<{ $color: string }>`
  font-size: 14px;
  color: ${(p) => p.$color};
`;

const SettlementAmount = styled.Text<{ $color: string }>`
  font-size: 18px;
  font-weight: 700;
  color: ${(p) => p.$color};
`;

const FAB = styled.TouchableOpacity<{ $bg: string }>`
  position: absolute;
  bottom: ${({ theme }) => theme.spacing.xxl}px;
  right: ${({ theme }) => theme.spacing.xxl}px;
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

const ActionRow = styled.View`
  flex-direction: row;
  padding: ${({ theme }) => theme.spacing.md}px ${({ theme }) => theme.spacing.lg}px;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const ActionButton = styled.TouchableOpacity<{ $bg: string }>`
  flex: 1;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: ${(p) => p.$bg};
  padding: ${({ theme }) => theme.spacing.md}px;
  border-radius: ${({ theme }) => theme.radii.md}px;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

const ActionText = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.$color};
`;

const ModalTitle = styled.Text<{ $color: string }>`
  font-size: 20px;
  font-weight: 700;
  color: ${(p) => p.$color};
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xl}px;
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

const ModalOverlay = styled.Pressable`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: flex-end;
`;

const ModalContent = styled.View<{ $bg: string }>`
  background-color: ${(p) => p.$bg};
  border-top-left-radius: ${({ theme }) => theme.radii.xxl}px;
  border-top-right-radius: ${({ theme }) => theme.radii.xxl}px;
  padding: ${({ theme }) => theme.spacing.xl}px;
  padding-bottom: ${({ theme }) => theme.spacing.xxxl + theme.spacing.sm}px;
`;

type TabType = 'expenses' | 'balances' | 'members';

const SPACE_ICONS: Record<SpaceType, string> = {
  couple: '💑',
  family: '👨‍👩‍👧‍👦',
  roommates: '🏠',
  trip: '✈️',
  project: '💼',
  custom: '⭐',
};

export default function SpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const colors = useColors();
  const theme = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  
  const { data: spaceData, isLoading: spaceLoading, refetch: refetchSpace } = useQuery({
    queryKey: ['space', id],
    queryFn: () => api.social.getSpace(id!),
    enabled: !!id,
  });
  
  const { data: expensesData, refetch: refetchExpenses } = useQuery({
    queryKey: ['space-expenses', id],
    queryFn: () => api.social.getSpaceExpenses(id!, { limit: 50 }),
    enabled: !!id,
  });
  
  const { data: balancesData, refetch: refetchBalances } = useQuery({
    queryKey: ['space-balances', id],
    queryFn: () => api.social.getBalanceSummary(id!),
    enabled: !!id,
  });
  
  const { data: suggestedData } = useQuery({
    queryKey: ['space-suggested', id],
    queryFn: () => api.social.getSuggestedSettlements(id!),
    enabled: !!id,
  });
  
  const { data: membersData, refetch: refetchMembers } = useQuery({
    queryKey: ['space-members', id],
    queryFn: () => api.social.getSpaceMembers(id!),
    enabled: !!id,
  });
  
  const inviteMutation = useMutation({
    mutationFn: (email: string) => api.social.inviteMember(id!, { email }),
    onSuccess: (data) => {
      showToast('Invite sent!', 'success');
      setShowInviteSheet(false);
      setInviteEmail('');
      Alert.alert(
        'Invite Code',
        `Share this code: ${data.invite.code}`,
        [
          {
            text: 'Copy',
            onPress: () => {
              Clipboard.setStringAsync(data.invite.code);
              showToast('Code copied!', 'success');
            },
          },
          { text: 'OK' },
        ]
      );
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to send invite');
    },
  });
  
  const space = spaceData?.space;
  const expenses = expensesData?.expenses || [];
  const balances = balancesData?.balances || [];
  const suggested = suggestedData?.settlements || [];
  const members = membersData?.members || [];
  const currency = space?.currency || 'USD';
  
  const myBalance = balances.find((b) => b.user_id === user?.id)?.net_balance || 0;
  
  const handleRefresh = () => {
    refetchSpace();
    refetchExpenses();
    refetchBalances();
    refetchMembers();
  };
  
  const formatAmount = (amount: number) => {
    return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)} ${currency}`;
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };
  
  if (spaceLoading) {
    return <LoadingSpinner />;
  }
  
  if (!space) {
    return (
      <EmptyState
        icon={Receipt}
        title="Space not found"
        description="This space may have been deleted."
      />
    );
  }
  
  const renderExpense = (expense: SharedExpense) => (
    <ExpenseCard
      key={expense.id}
      $bg={colors.card}
      onPress={() => router.push(`/spaces/${id}/expense/${expense.id}` as any)}
    >
      <ExpenseIcon $bg={theme.alpha(colors.primary, 0.125)}>
        <Receipt size={22} color={colors.primary} />
      </ExpenseIcon>
      <ExpenseInfo>
        <ExpenseTitle $color={colors.foreground}>{expense.title}</ExpenseTitle>
        <ExpenseSubtitle $color={colors.mutedForeground}>
          {t('paidBy') || 'Paid by'} {expense.paid_by_name || 'Unknown'} • {formatDate(expense.date || expense.expense_date)}
        </ExpenseSubtitle>
      </ExpenseInfo>
      <ExpenseAmount $color={colors.foreground}>
        {expense.amount.toFixed(2)} {currency}
      </ExpenseAmount>
    </ExpenseCard>
  );
  
  const renderBalance = (balance: BalanceSummary) => (
    <MemberCard key={balance.member_id} $bg={colors.card}>
      <MemberAvatar $bg={theme.alpha(colors.primary, 0.125)}>
        <User size={22} color={colors.primary} />
      </MemberAvatar>
      <MemberInfo>
        <MemberName $color={colors.foreground}>{balance.member_name}</MemberName>
        <MemberRole $color={colors.mutedForeground}>
          {t('totalPaid') || 'Paid'}: {balance.total_paid.toFixed(2)} • {t('totalOwed') || 'Owed'}: {balance.total_owed.toFixed(2)}
        </MemberRole>
      </MemberInfo>
      <MemberBalance $isNegative={balance.net_balance < 0}>
        {formatAmount(balance.net_balance)}
      </MemberBalance>
    </MemberCard>
  );
  
  const renderSettlement = (settlement: SuggestedSettlement) => (
    <SettlementCard key={`${settlement.from_member_id}-${settlement.to_member_id}`} $bg={colors.card}>
      <SettlementInfo>
        <SettlementText $color={colors.foreground}>
          <SettlementText $color={colors.danger}>{settlement.from_member_name}</SettlementText>
          {' → '}
          <SettlementText $color={colors.success}>{settlement.to_member_name}</SettlementText>
        </SettlementText>
      </SettlementInfo>
      <SettlementAmount $color={colors.primary}>
        {settlement.amount.toFixed(2)} {currency}
      </SettlementAmount>
    </SettlementCard>
  );
  
  const renderMember = (member: SpaceMember) => {
    const balance = balances.find((b) => b.member_id === member.id);
    return (
      <MemberCard key={member.id} $bg={colors.card}>
        <MemberAvatar $bg={theme.alpha(colors.primary, 0.125)}>
          <User size={22} color={colors.primary} />
        </MemberAvatar>
        <MemberInfo>
          <MemberName $color={colors.foreground}>
            {member.nickname || member.user_name || member.user_email || 'Member'}
          </MemberName>
          <MemberRole $color={colors.mutedForeground}>
            {t(`spaceRoles.${member.role}`) || member.role}
          </MemberRole>
        </MemberInfo>
        {balance && (
          <MemberBalance $isNegative={balance.net_balance < 0}>
            {formatAmount(balance.net_balance)}
          </MemberBalance>
        )}
      </MemberCard>
    );
  };
  
  return (
    <>
      <Stack.Screen
        options={{
          title: space.name,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/spaces/${id}/settings` as any)}
              accessibilityLabel={t('spaceSettings') || 'Space settings'}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Settings size={24} color={colors.foreground} />
            </Pressable>
          ),
        }}
      />
      
      <Container $bg={colors.background}>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={handleRefresh} />
          }
        >
          <Header $color={space.color || colors.primary}>
            <SpaceTitle $color={colors.foreground}>
              {SPACE_ICONS[space.type]} {space.name}
            </SpaceTitle>
            <SpaceSubtitle $color={colors.mutedForeground}>
              {members.length} {t('spaceMembers') || 'members'} • {currency}
            </SpaceSubtitle>
          </Header>
          
          <BalanceCard $bg={colors.card}>
            <BalanceLabel $color={colors.mutedForeground}>
              {t('netBalance') || 'Your Balance'}
            </BalanceLabel>
            <BalanceValue $color={colors.foreground} $isNegative={myBalance < 0}>
              {formatAmount(myBalance)}
            </BalanceValue>
          </BalanceCard>
          
          <ActionRow>
            <ActionButton $bg={colors.card} onPress={() => setShowInviteSheet(true)}>
              <UserPlus size={18} color={colors.primary} />
              <ActionText $color={colors.foreground}>{t('inviteMember') || 'Invite'}</ActionText>
            </ActionButton>
            <ActionButton $bg={colors.card} onPress={() => router.push(`/spaces/${id}/settle` as any)}>
              <ArrowLeftRight size={18} color={colors.success} />
              <ActionText $color={colors.foreground}>{t('settleUp') || 'Settle'}</ActionText>
            </ActionButton>
          </ActionRow>
          
          <TabRow>
            <Tab
              $active={activeTab === 'expenses'}
              $bg={colors.card}
              $activeBg={colors.primary}
              onPress={() => setActiveTab('expenses')}
            >
              <TabText $active={activeTab === 'expenses'} $color={colors.mutedForeground}>
                {t('sharedExpenses') || 'Expenses'}
              </TabText>
            </Tab>
            <Tab
              $active={activeTab === 'balances'}
              $bg={colors.card}
              $activeBg={colors.primary}
              onPress={() => setActiveTab('balances')}
            >
              <TabText $active={activeTab === 'balances'} $color={colors.mutedForeground}>
                {t('balances') || 'Balances'}
              </TabText>
            </Tab>
            <Tab
              $active={activeTab === 'members'}
              $bg={colors.card}
              $activeBg={colors.primary}
              onPress={() => setActiveTab('members')}
            >
              <TabText $active={activeTab === 'members'} $color={colors.mutedForeground}>
                {t('spaceMembers') || 'Members'}
              </TabText>
            </Tab>
          </TabRow>
          
          {activeTab === 'expenses' && (
            expenses.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={t('noExpensesYet') || 'No expenses yet'}
                description={t('noExpensesDesc') || 'Add your first shared expense.'}
              />
            ) : (
              expenses.map(renderExpense)
            )
          )}
          
          {activeTab === 'balances' && (
            <>
              {suggested.length > 0 && (
                <View style={{ marginBottom: theme.spacing.lg }}>
                  <InputLabel $color={colors.mutedForeground} style={{ paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.sm }}>
                    {t('suggestedSettlements') || 'Suggested Settlements'}
                  </InputLabel>
                  {suggested.map(renderSettlement)}
                </View>
              )}
              {balances.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title={t('allSettledUp') || 'All settled up!'}
                  description={t('allSettledUpDesc') || 'No outstanding balances.'}
                />
              ) : (
                balances.map(renderBalance)
              )}
            </>
          )}
          
          {activeTab === 'members' && members.map(renderMember)}
          
          <View style={{ height: 100 }} />
        </ScrollView>
        
        {activeTab === 'expenses' && (
          <FAB
            $bg={colors.primary}
            onPress={() => router.push(`/spaces/${id}/add-expense` as any)}
            accessibilityLabel={t('a11yAdd') || 'Add'}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Plus size={28} color={colors.primaryForeground} />
          </FAB>
        )}
      </Container>
      
      <Modal
        visible={showInviteSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInviteSheet(false)}
      >
        <ModalOverlay onPress={() => setShowInviteSheet(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <ModalContent $bg={colors.background}>
              <ModalTitle $color={colors.foreground}>
                {t('inviteMember') || 'Invite Member'}
              </ModalTitle>
              
              <InputContainer>
                <InputLabel $color={colors.foreground}>
                  {t('inviteByEmail') || 'Email Address'}
                </InputLabel>
                <StyledInput
                  $bg={colors.card}
                  $color={colors.foreground}
                  $border={colors.border}
                  placeholder="friend@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </InputContainer>
              
              <Button
                variant="primary"
                onPress={() => inviteMutation.mutate(inviteEmail)}
                disabled={!inviteEmail.trim() || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? t('loading') || 'Sending...' : t('inviteMember') || 'Send Invite'}
              </Button>
            </ModalContent>
          </Pressable>
        </ModalOverlay>
      </Modal>
    </>
  );
}
