import { memo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';
import { formatNumber } from '../../../utils/format';
import type { PendingAction } from './types';
import type { SmartParseResponse } from '../../../types/wallet';

export interface ChatPendingActionFlowProps {
  pendingAction: PendingAction;
  onDismiss: () => void;
  onApplyTransaction: (parsed: SmartParseResponse) => void;
  isApplyingTransaction: boolean;
  onApplyRecurring: (parsed: SmartParseResponse, frequency: string) => void;
  isApplyingRecurring: boolean;
  onApplyGoalContribution: (data: { amount: number; goalId: string; goalName?: string }) => void;
  isApplyingGoalContribution: boolean;
  onApplyConversion: (data: { from: string; to: string; amount: number }) => void;
  onSetFrequency: (frequency: string) => void;
  onSetGoalID: (goalId: string) => void;
  onSetError: (error: string | null) => void;
}

export const ChatPendingActionFlow = memo(function ChatPendingActionFlow({
  pendingAction,
  onDismiss,
  onApplyTransaction,
  isApplyingTransaction,
  onApplyRecurring,
  isApplyingRecurring,
  onApplyGoalContribution,
  isApplyingGoalContribution,
  onApplyConversion,
  onSetFrequency,
  onSetGoalID,
  onSetError,
}: ChatPendingActionFlowProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;

  // Editable transaction state for validation workflow
  const [editMode, setEditMode] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'credit' | 'debit'>('debit');
  const [editCurrency, setEditCurrency] = useState('USD');
  const [editDescription, setEditDescription] = useState('');

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', width: '100%', alignItems: 'flex-start' }}>
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, maxWidth: '92%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {pendingAction.kind === 'transaction'
                ? 'Transaction assistant'
                : pendingAction.kind === 'recurring'
                  ? 'Recurring transaction'
                  : pendingAction.kind === 'goal_contribution'
                    ? 'Goal contribution'
                    : pendingAction.kind === 'convert'
                      ? 'Conversion assistant'
                      : 'Live FX rate'}
            </Text>
            {pendingAction.status === 'done' && (
              <CheckCircle2 size={16} color={colors.success} />
            )}
            {pendingAction.status === 'error' && (
              <AlertTriangle size={16} color={colors.danger} />
            )}
          </View>

          {pendingAction.status === 'loading' && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ fontSize: 14, color: colors.mutedForeground, marginStart: 8 }}>
                {pendingAction.kind === 'transaction' || pendingAction.kind === 'recurring' || pendingAction.kind === 'goal_contribution'
                  ? 'Analyzing...'
                  : 'Fetching rate...'}
              </Text>
            </View>
          )}

          {pendingAction.status === 'error' && (
            <Text style={{ fontSize: 14, color: colors.danger }}>
              {pendingAction.error || 'Something went wrong.'}
            </Text>
          )}

          {pendingAction.kind === 'transaction' && pendingAction.status === 'ready' && pendingAction.parsed && (
            <>
              {!editMode ? (
                <>
                  {/* Preview Mode */}
                  <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: pendingAction.parsed.type === 'credit' ? colors.success + '33' : colors.danger + '33' }}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: pendingAction.parsed.type === 'credit' ? colors.success : colors.danger }}>
                          {pendingAction.parsed.type === 'credit' ? 'Income' : 'Expense'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                        {pendingAction.parsed.currency} {pendingAction.parsed.amount.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>
                      {pendingAction.parsed.description}
                    </Text>
                    {pendingAction.parsed.category && pendingAction.parsed.category !== 'other' && (
                      <Text style={{ fontSize: 12, color: colors.accent }}>
                        Category: {pendingAction.parsed.category}
                      </Text>
                    )}
                    {pendingAction.parsed.confidence < 0.8 && (
                      <View style={{ marginTop: 8, backgroundColor: colors.warning + '1A', padding: 8, borderRadius: 4 }}>
                        <Text style={{ fontSize: 12, color: colors.warning }}>
                          Low confidence ({(pendingAction.parsed.confidence * 100).toFixed(0)}%) - Please verify details
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Pressable
                      onPress={() => onApplyTransaction(pendingAction.parsed!)}
                      disabled={isApplyingTransaction}
                      style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: isApplyingTransaction ? 0.5 : pressed ? 0.7 : 1 }]}
                    >
                      <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                        {isApplyingTransaction ? 'Adding...' : 'Add transaction'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setEditAmount(pendingAction.parsed!.amount.toString());
                        setEditType(pendingAction.parsed!.type);
                        setEditCurrency(pendingAction.parsed!.currency);
                        setEditDescription(pendingAction.parsed!.description);
                        setEditMode(true);
                      }}
                      style={({ pressed }) => [{ backgroundColor: colors.secondary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={onDismiss}
                      style={({ pressed }) => [{ paddingHorizontal: 16, paddingVertical: 8 }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Dismiss</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {/* Edit Mode */}
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>Type</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={() => setEditType('debit')}
                        style={({ pressed }) => [{ flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, backgroundColor: editType === 'debit' ? colors.danger + '33' : colors.muted, borderColor: editType === 'debit' ? colors.danger : colors.border }, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={{ fontSize: 12, textAlign: 'center', fontFamily: 'Inter_600SemiBold', color: editType === 'debit' ? colors.danger : colors.mutedForeground }}>
                          Expense
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEditType('credit')}
                        style={({ pressed }) => [{ flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, backgroundColor: editType === 'credit' ? colors.success + '33' : colors.muted, borderColor: editType === 'credit' ? colors.success : colors.border }, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={{ fontSize: 12, textAlign: 'center', fontFamily: 'Inter_600SemiBold', color: editType === 'credit' ? colors.success : colors.mutedForeground }}>
                          Income
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                    <View style={{ flex: 2 }}>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Amount</Text>
                      <TextInput
                        value={editAmount}
                        onChangeText={setEditAmount}
                        keyboardType="decimal-pad"
                        style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontSize: 14, outlineStyle: 'none' } as any}
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Currency</Text>
                      <TextInput
                        value={editCurrency}
                        onChangeText={(text) => setEditCurrency(text.toUpperCase())}
                        maxLength={3}
                        style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontSize: 14, outlineStyle: 'none' } as any}
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Description</Text>
                    <TextInput
                      value={editDescription}
                      onChangeText={setEditDescription}
                      style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontSize: 14, outlineStyle: 'none' } as any}
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        const parsedAmount = parseFloat(editAmount);
                        if (isNaN(parsedAmount) || parsedAmount <= 0) {
                          onSetError('Please enter a valid amount');
                          return;
                        }
                        onApplyTransaction({
                          amount: parsedAmount,
                          type: editType,
                          currency: editCurrency,
                          description: editDescription,
                          category: 'other',
                          action_type: 'transaction',
                          confidence: 1,
                        });
                        setEditMode(false);
                      }}
                      disabled={isApplyingTransaction}
                      style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: isApplyingTransaction ? 0.5 : pressed ? 0.7 : 1 }]}
                    >
                      <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                        {isApplyingTransaction ? 'Adding...' : 'Confirm & Add'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditMode(false)}
                      style={({ pressed }) => [{ backgroundColor: colors.secondary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </>
          )}

          {/* Recurring Transaction Card */}
          {pendingAction.kind === 'recurring' && pendingAction.status === 'ready' && pendingAction.parsed && (
            <>
              <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: pendingAction.parsed.type === 'credit' ? colors.success + '33' : colors.danger + '33' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: pendingAction.parsed.type === 'credit' ? colors.success : colors.danger }}>
                      {pendingAction.parsed.type === 'credit' ? 'Recurring Income' : 'Recurring Expense'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                    {pendingAction.parsed.currency} {pendingAction.parsed.amount.toFixed(2)}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>
                  {pendingAction.parsed.description}
                </Text>
                {pendingAction.parsed.category && pendingAction.parsed.category !== 'other' && (
                  <Text style={{ fontSize: 12, color: colors.accent }}>
                    Category: {pendingAction.parsed.category}
                  </Text>
                )}
              </View>
              {/* Frequency selector */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>Frequency</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['daily', 'weekly', 'monthly', 'yearly'].map((freq) => (
                    <Pressable
                      key={freq}
                      onPress={() => onSetFrequency(freq)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        backgroundColor: pendingAction.selectedFrequency === freq ? colors.primary + '33' : colors.muted,
                        borderColor: pendingAction.selectedFrequency === freq ? colors.primary : colors.border,
                      }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontFamily: 'Inter_500Medium',
                        textTransform: 'capitalize',
                        color: pendingAction.selectedFrequency === freq ? colors.accent : colors.foreground,
                      }}>
                        {freq}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable
                  onPress={() => onApplyRecurring(
                    pendingAction.parsed!,
                    pendingAction.selectedFrequency || 'monthly',
                  )}
                  disabled={isApplyingRecurring}
                  style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: isApplyingRecurring ? 0.5 : pressed ? 0.7 : 1 }]}
                >
                  <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                    {isApplyingRecurring ? 'Creating...' : 'Create recurring'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onDismiss}
                  style={({ pressed }) => [{ paddingHorizontal: 16, paddingVertical: 8 }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Dismiss</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Goal Contribution Card */}
          {pendingAction.kind === 'goal_contribution' && pendingAction.status === 'ready' && pendingAction.parsed && (
            <>
              <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: colors.accent + '33' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.accent }}>Goal Contribution</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                    {pendingAction.parsed.currency} {pendingAction.parsed.amount.toFixed(2)}
                  </Text>
                </View>
                {pendingAction.parsed.goal_name && (
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    Detected goal: {pendingAction.parsed.goal_name}
                  </Text>
                )}
              </View>
              {/* Goal selector */}
              {pendingAction.goals && pendingAction.goals.length > 0 ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>Select goal to contribute to</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {pendingAction.goals.map((goal) => (
                        <Pressable
                          key={goal.id}
                          onPress={() => onSetGoalID(goal.id)}
                          style={({ pressed }) => [{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            backgroundColor: pendingAction.selectedGoalID === goal.id ? colors.primary + '33' : colors.muted,
                            borderColor: pendingAction.selectedGoalID === goal.id ? colors.primary : colors.border,
                          }, pressed && { opacity: 0.7 }]}
                        >
                          <Text style={{
                            fontSize: 12,
                            fontFamily: 'Inter_500Medium',
                            color: pendingAction.selectedGoalID === goal.id ? colors.accent : colors.foreground,
                          }}>
                            {goal.name}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                            {goal.currency} {goal.current_amount.toFixed(0)} / {goal.target_amount.toFixed(0)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ) : (
                <View style={{ marginBottom: 12, backgroundColor: colors.warning + '1A', padding: 8, borderRadius: 4 }}>
                  <Text style={{ fontSize: 12, color: colors.warning }}>
                    No goals found. Create a goal first to contribute.
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable
                  onPress={() => {
                    if (!pendingAction.selectedGoalID) {
                      Alert.alert('Select Goal', 'Please select a goal to contribute to');
                      return;
                    }
                    onApplyGoalContribution({
                      amount: pendingAction.parsed!.amount,
                      goalId: pendingAction.selectedGoalID,
                      goalName: pendingAction.parsed!.goal_name,
                    });
                  }}
                  disabled={isApplyingGoalContribution || !pendingAction.selectedGoalID}
                  style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: isApplyingGoalContribution || !pendingAction.selectedGoalID ? 0.5 : pressed ? 0.7 : 1 }]}
                >
                  <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                    {isApplyingGoalContribution ? 'Contributing...' : 'Contribute'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onDismiss}
                  style={({ pressed }) => [{ paddingHorizontal: 16, paddingVertical: 8 }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Dismiss</Text>
                </Pressable>
              </View>
            </>
          )}

          {pendingAction.kind === 'convert' && pendingAction.status === 'ready' && pendingAction.result && (
            <>
              <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                  {pendingAction.amount} {pendingAction.from} →{' '}
                  {formatNumber(pendingAction.result.result, 2)} {pendingAction.to}
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4 }}>
                  Rate: {formatNumber(pendingAction.result.rate, 4)} {pendingAction.to}/{pendingAction.from}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() =>
                    onApplyConversion({
                      from: pendingAction.from,
                      to: pendingAction.to,
                      amount: pendingAction.amount,
                    })
                  }
                  style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                    Convert in wallet
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onDismiss}
                  style={({ pressed }) => [{ backgroundColor: colors.secondary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Dismiss</Text>
                </Pressable>
              </View>
            </>
          )}

          {pendingAction.kind === 'rate' && pendingAction.status === 'ready' && pendingAction.result && (
            <>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                1 {pendingAction.from} = {formatNumber(pendingAction.result.rate, 4)} {pendingAction.to}
              </Text>
              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [{ backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginTop: 12, alignSelf: 'flex-start' }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Dismiss</Text>
              </Pressable>
            </>
          )}

          {pendingAction.status === 'done' && (
            <Text style={{ fontSize: 14, color: colors.success }}>
              {pendingAction.kind === 'transaction'
                ? t('transactionAdded') || 'Transaction added.'
                : pendingAction.kind === 'recurring'
                  ? t('recurringCreated') || 'Recurring transaction created.'
                  : pendingAction.kind === 'goal_contribution'
                    ? t('contributionAdded') || 'Contribution added to goal.'
                    : pendingAction.kind === 'convert'
                      ? t('conversionCompleted') || 'Conversion completed.'
                      : t('rateUpdated') || 'Rate updated.'}
            </Text>
          )}
        </View>
      </View>
  );
});
