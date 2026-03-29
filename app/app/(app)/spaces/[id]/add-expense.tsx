import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components/native';
import { User, Check } from 'lucide-react-native';

import { api } from '@/src/api';
import { SplitMethod, CreateExpenseRequest, SpaceMember } from '@/src/api/social';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/components/ui/Toast';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';

const Container = styled.View<{ $bg: string }>`
  flex: 1;
  background-color: ${(p) => p.$bg};
`;

const Content = styled.ScrollView`
  flex: 1;
  padding: 16px;
`;

const Section = styled.View`
  margin-bottom: 24px;
`;

const SectionTitle = styled.Text<{ $color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.$color};
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

const AmountInput = styled.TextInput<{ $bg: string; $color: string }>`
  background-color: ${(p) => p.$bg};
  color: ${(p) => p.$color};
  border-radius: 16px;
  padding: 20px;
  font-size: 32px;
  font-weight: 700;
  text-align: center;
`;

const SplitMethodGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

const SplitMethodChip = styled.TouchableOpacity<{ $bg: string; $selected: boolean; $selectedBg: string }>`
  flex: 1;
  min-width: 45%;
  padding: 14px;
  border-radius: 12px;
  background-color: ${(p) => (p.$selected ? p.$selectedBg : p.$bg)};
  align-items: center;
`;

const SplitMethodText = styled.Text<{ $color: string; $selected: boolean }>`
  font-size: 14px;
  font-weight: ${(p) => (p.$selected ? '700' : '500')};
  color: ${(p) => (p.$selected ? '#fff' : p.$color)};
`;

const MemberRow = styled.TouchableOpacity<{ $bg: string; $selected: boolean }>`
  flex-direction: row;
  align-items: center;
  background-color: ${(p) => p.$bg};
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 8px;
  opacity: ${(p) => (p.$selected ? 1 : 0.6)};
`;

const MemberAvatar = styled.View<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${(p) => p.$bg};
  align-items: center;
  justify-content: center;
  margin-right: 12px;
`;

const MemberInfo = styled.View`
  flex: 1;
`;

const MemberName = styled.Text<{ $color: string }>`
  font-size: 15px;
  font-weight: 600;
  color: ${(p) => p.$color};
`;

const MemberShare = styled.Text<{ $color: string }>`
  font-size: 13px;
  color: ${(p) => p.$color};
  margin-top: 2px;
`;

const Checkbox = styled.View<{ $checked: boolean; $color: string }>`
  width: 24px;
  height: 24px;
  border-radius: 12px;
  border-width: 2px;
  border-color: ${(p) => p.$color};
  background-color: ${(p) => (p.$checked ? p.$color : 'transparent')};
  align-items: center;
  justify-content: center;
`;

const Footer = styled.View<{ $bg: string }>`
  padding: 16px;
  border-top-width: 1px;
  border-top-color: ${(p) => p.$bg};
`;

const SPLIT_METHODS: { method: SplitMethod; icon: string }[] = [
  { method: 'equal', icon: '=' },
  { method: 'percentage', icon: '%' },
  { method: 'shares', icon: '÷' },
  { method: 'exact', icon: '$' },
];

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const colors = useColors();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [paidBy, setPaidBy] = useState<string>('');
  
  const { data: spaceData, isLoading: spaceLoading } = useQuery({
    queryKey: ['space', id],
    queryFn: () => api.social.getSpace(id!),
    enabled: !!id,
  });
  
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['space-members', id],
    queryFn: () => api.social.getSpaceMembers(id!),
    enabled: !!id,
  });
  
  // Select all members by default when members load
  useEffect(() => {
    if (membersData?.members) {
      const allMemberIds = new Set(
        membersData.members.map((m: SpaceMember) => m.user_id).filter(Boolean)
      );
      setSelectedMembers(allMemberIds);
      // Set current user as payer by default.
      if (membersData.members.length > 0 && !paidBy) {
        const myMember = user ? membersData.members.find((m: SpaceMember) => m.user_id === user.id) : undefined;
        setPaidBy((myMember?.user_id || membersData.members[0].user_id) as string);
      }
    }
  }, [membersData?.members, paidBy, user]);
  
  const createMutation = useMutation({
    mutationFn: (data: CreateExpenseRequest) => api.social.createExpense(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-expenses', id] });
      queryClient.invalidateQueries({ queryKey: ['space-balances', id] });
      showToast('Expense added!', 'success');
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to add expense');
    },
  });
  
  const space = spaceData?.space;
  const members = membersData?.members || [];
  const currency = space?.currency || 'USD';
  
  const handleToggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };
  
  const getShareAmount = (memberId: string): number => {
    const numericAmount = parseFloat(amount) || 0;
    const selectedCount = selectedMembers.size;
    if (selectedCount === 0 || !selectedMembers.has(memberId)) return 0;
    
    if (splitMethod === 'equal') {
      return numericAmount / selectedCount;
    }
    // For other methods, would need more complex handling
    return numericAmount / selectedCount;
  };
  
  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an expense title');
      return;
    }
    
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    if (selectedMembers.size === 0) {
      Alert.alert('Error', 'Please select at least one member to split with');
      return;
    }
    
    if (!paidBy) {
      Alert.alert('Error', 'Please select who paid');
      return;
    }
    
    const splits = Array.from(selectedMembers).map((memberId) => ({
      member_id: memberId,
      amount: getShareAmount(memberId),
    }));
    
    createMutation.mutate({
      title: title.trim(),
      amount: numericAmount,
      currency,
      category: category.trim() || undefined,
      split_method: splitMethod,
      splits,
    });
  };
  
  const getSplitMethodName = (method: SplitMethod) => {
    const key = `splitMethods.${method}` as const;
    return t(key) || method;
  };
  
  if (spaceLoading || membersLoading) {
    return <LoadingSpinner />;
  }
  
  return (
    <>
      <Stack.Screen
        options={{
          title: t('addExpense') || 'Add Expense',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }}
      />
      
      <Container $bg={colors.background}>
        <Content>
          <Section>
            <AmountInput
              $bg={colors.card}
              $color={colors.foreground}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <InputLabel $color={colors.mutedForeground} style={{ textAlign: 'center', marginTop: 8 }}>
              {currency}
            </InputLabel>
          </Section>
          
          <Section>
            <InputContainer>
              <InputLabel $color={colors.foreground}>
                {t('expenseTitle') || 'Title'}
              </InputLabel>
              <StyledInput
                $bg={colors.card}
                $color={colors.foreground}
                $border={colors.border}
                placeholder={t('expenseTitle') || 'e.g., Dinner, Groceries'}
                placeholderTextColor={colors.mutedForeground}
                value={title}
                onChangeText={setTitle}
              />
            </InputContainer>
            
            <InputContainer>
              <InputLabel $color={colors.foreground}>
                {t('expenseCategory') || 'Category'} ({t('optional') || 'optional'})
              </InputLabel>
              <StyledInput
                $bg={colors.card}
                $color={colors.foreground}
                $border={colors.border}
                placeholder={t('expenseCategory') || 'e.g., Food, Transport'}
                placeholderTextColor={colors.mutedForeground}
                value={category}
                onChangeText={setCategory}
              />
            </InputContainer>
          </Section>
          
          <Section>
            <SectionTitle $color={colors.mutedForeground}>
              {t('paidBy') || 'Paid By'}
            </SectionTitle>
            {members.map((member: SpaceMember) => (
              <MemberRow
                key={member.id}
                $bg={colors.card}
                $selected={paidBy === member.user_id}
                onPress={() => setPaidBy(member.user_id)}
              >
                <MemberAvatar $bg={colors.primary + '20'}>
                  <User size={18} color={colors.primary} />
                </MemberAvatar>
                <MemberInfo>
                  <MemberName $color={colors.foreground}>
                    {member.nickname || member.user_name || member.user_email || 'Member'}
                  </MemberName>
                </MemberInfo>
                <Checkbox $checked={paidBy === member.user_id} $color={colors.primary}>
                  {paidBy === member.user_id && <Check size={16} color="#fff" />}
                </Checkbox>
              </MemberRow>
            ))}
          </Section>
          
          <Section>
            <SectionTitle $color={colors.mutedForeground}>
              {t('splitMethod') || 'Split Method'}
            </SectionTitle>
            <SplitMethodGrid>
              {SPLIT_METHODS.map((item) => (
                <SplitMethodChip
                  key={item.method}
                  $bg={colors.card}
                  $selected={splitMethod === item.method}
                  $selectedBg={colors.primary}
                  onPress={() => setSplitMethod(item.method)}
                >
                  <SplitMethodText
                    $color={colors.foreground}
                    $selected={splitMethod === item.method}
                  >
                    {item.icon} {getSplitMethodName(item.method)}
                  </SplitMethodText>
                </SplitMethodChip>
              ))}
            </SplitMethodGrid>
          </Section>
          
          <Section>
            <SectionTitle $color={colors.mutedForeground}>
              {t('splitWith') || 'Split With'}
            </SectionTitle>
            {members.map((member: SpaceMember) => {
              const isSelected = selectedMembers.has(member.user_id);
              const shareAmount = getShareAmount(member.user_id);
              return (
                <MemberRow
                  key={member.id}
                  $bg={colors.card}
                  $selected={isSelected}
                  onPress={() => handleToggleMember(member.user_id)}
                >
                  <MemberAvatar $bg={colors.primary + '20'}>
                    <User size={18} color={colors.primary} />
                  </MemberAvatar>
                  <MemberInfo>
                    <MemberName $color={colors.foreground}>
                      {member.nickname || member.user_name || member.user_email || 'Member'}
                    </MemberName>
                    {isSelected && shareAmount > 0 && (
                      <MemberShare $color={colors.mutedForeground}>
                        {t('yourShare') || 'Share'}: {shareAmount.toFixed(2)} {currency}
                      </MemberShare>
                    )}
                  </MemberInfo>
                  <Checkbox $checked={isSelected} $color={colors.primary}>
                    {isSelected && <Check size={16} color="#fff" />}
                  </Checkbox>
                </MemberRow>
              );
            })}
          </Section>
        </Content>
        
        <Footer $bg={colors.border}>
          <Button
            variant="primary"
            onPress={handleCreate}
            disabled={!title.trim() || !amount || createMutation.isPending}
          >
            {createMutation.isPending
              ? t('loading') || 'Adding...'
              : t('addExpense') || 'Add Expense'}
          </Button>
        </Footer>
      </Container>
    </>
  );
}
