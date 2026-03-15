import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bot, CheckCircle, Sparkles, Target, Wallet } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { Card, Select } from '../../src/components/ui';
import { useLanguage } from '../../src/context/LanguageContext';
import { useAuth } from '../../src/context/AuthContext';
import { useCurrencies } from '../../src/hooks';

type Step = 'welcome' | 'currency' | 'assistant' | 'balance' | 'complete';

const STEPS: Step[] = ['welcome', 'currency', 'assistant', 'balance', 'complete'];
const FOCUS_AREAS = [
  { id: 'spending', label: 'Spending' },
  { id: 'saving', label: 'Saving' },
  { id: 'budgeting', label: 'Budgeting' },
  { id: 'debt', label: 'Debt' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'general', label: 'General' },
] as const;

export default function OnboardingScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const colors = theme.colors;

  const [step, setStep] = useState<Step>('welcome');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [focusArea, setFocusArea] = useState<string>('general');
  const [weeklyBriefEnabled, setWeeklyBriefEnabled] = useState(true);
  const [proactiveAlertsEnabled, setProactiveAlertsEnabled] = useState(true);
  const [initialBalance, setInitialBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: currencies } = useCurrencies();
  const currentIndex = STEPS.indexOf(step);
  const isLargeScreen = width > 768;
  const formMaxWidth = isLargeScreen ? 560 : '100%';

  const currencyOptions = useMemo(
    () =>
      currencies?.map((currency: { code: string; name: string }) => ({
        label: `${currency.code} - ${currency.name}`,
        value: currency.code,
      })) || [],
    [currencies]
  );

  const goNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex]);
      setError('');
    }
  };

  const goBack = () => {
    const previousIndex = currentIndex - 1;
    if (previousIndex >= 0) {
      setStep(STEPS[previousIndex]);
      setError('');
    }
  };

  const persistOnboarding = async () => {
    await api.coai.updatePreferences({
      preferred_currency: selectedCurrency,
      focus_areas: [focusArea],
      weekly_brief_enabled: weeklyBriefEnabled,
      proactive_alerts_enabled: proactiveAlertsEnabled,
    });

    const parsedBalance = Number.parseFloat(initialBalance);
    if (!Number.isNaN(parsedBalance) && parsedBalance > 0) {
      await api.wallet.addTransaction({
        currency: selectedCurrency,
        amount: parsedBalance,
        type: 'credit',
        category: 'income',
        description: 'Initial balance',
      });
    }

    await api.auth.completeOnboarding();
    await refreshProfile();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wallet'] }),
      queryClient.invalidateQueries({ queryKey: ['goals'] }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: ['coai-brief'] }),
      queryClient.invalidateQueries({ queryKey: ['coai-preferences'] }),
    ]);
  };

  const finishOnboarding = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      await persistOnboarding();
      router.replace('/(app)/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const skipWithDefaults = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      await persistOnboarding();
      router.replace('/(app)/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFooter = (primaryLabel: string, onPrimaryPress: () => void) => (
    <View style={{ gap: 12 }}>
      {error ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.danger + '33',
            backgroundColor: colors.dangerMuted,
            padding: 12,
          }}
        >
          <Text style={{ color: colors.danger }}>{error}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {currentIndex > 0 ? (
          <Pressable
            onPress={goBack}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }}>
              {t('back') || 'Back'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onPrimaryPress}
          disabled={isSubmitting}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
              {primaryLabel}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            padding: 24,
            alignItems: 'center',
          }}
        >
          <View style={{ width: '100%', maxWidth: formMaxWidth }}>
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {STEPS.map((value, index) => (
                  <View
                    key={value}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 999,
                      backgroundColor: index <= currentIndex ? colors.primary : colors.muted,
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                {currentIndex + 1} / {STEPS.length}
              </Text>
            </View>

            <Card style={{ padding: 24 }}>
              {step === 'welcome' ? (
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 999,
                      backgroundColor: colors.primary + '18',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 20,
                    }}
                  >
                    <Bot size={38} color={colors.primary} />
                  </View>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 28,
                      textAlign: 'center',
                      fontFamily: 'Inter_700Bold',
                    }}
                  >
                    Welcome to CoAI
                  </Text>
                  <Text style={{ color: colors.mutedForeground, textAlign: 'center', fontSize: 15, lineHeight: 22, marginTop: 12 }}>
                    Set up CoAI as your personal finance copilot. We’ll save your preferred currency, what you care about most, and how proactive you want CoAI to be.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18, justifyContent: 'center' }}>
                    {['Guided actions', 'Weekly briefs', 'Budget alerts'].map((item) => (
                      <View
                        key={item}
                        style={{
                          borderRadius: 999,
                          backgroundColor: colors.secondary,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: colors.secondaryForeground, fontSize: 12 }}>{item}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ marginTop: 28, width: '100%', gap: 12 }}>
                    {renderFooter(t('getStarted') || 'Get started', goNext)}
                    <Pressable onPress={skipWithDefaults} disabled={isSubmitting}>
                      <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                        {t('skip') || 'Skip'} and use defaults
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {step === 'currency' ? (
                <View>
                  <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 999,
                        backgroundColor: colors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                      }}
                    >
                      <Wallet size={28} color={colors.secondaryForeground} />
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: 'Inter_700Bold' }}>
                      Preferred currency
                    </Text>
                    <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>
                      CoAI uses this as the default currency for briefs, alerts, and guided actions.
                    </Text>
                  </View>

                  <Select
                    value={selectedCurrency}
                    onValueChange={setSelectedCurrency}
                    options={currencyOptions}
                    placeholder="Select currency"
                  />

                  <View style={{ marginTop: 24 }}>
                    {renderFooter(t('next') || 'Next', goNext)}
                  </View>
                </View>
              ) : null}

              {step === 'assistant' ? (
                <View>
                  <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 999,
                        backgroundColor: colors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                      }}
                    >
                      <Sparkles size={28} color={colors.secondaryForeground} />
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: 'Inter_700Bold' }}>
                      What should CoAI focus on?
                    </Text>
                    <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>
                      Pick the financial area you want CoAI to prioritize first.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {FOCUS_AREAS.map((item) => {
                      const selected = focusArea === item.id;

                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setFocusArea(item.id)}
                          style={{
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primary + '15' : colors.card,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                          }}
                        >
                          <Text
                            style={{
                              color: selected ? colors.primary : colors.foreground,
                              fontFamily: selected ? 'Inter_600SemiBold' : 'Inter_500Medium',
                            }}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={{ gap: 12, marginTop: 24 }}>
                    <Pressable
                      onPress={() => setWeeklyBriefEnabled((value) => !value)}
                      style={{
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondary,
                        padding: 16,
                      }}
                    >
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                        Weekly brief
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 4 }}>
                        Receive a regular recap with what changed and what needs attention.
                      </Text>
                      <Text style={{ color: weeklyBriefEnabled ? colors.primary : colors.mutedForeground, marginTop: 10 }}>
                        {weeklyBriefEnabled ? 'Enabled' : 'Disabled'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setProactiveAlertsEnabled((value) => !value)}
                      style={{
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondary,
                        padding: 16,
                      }}
                    >
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                        Proactive alerts
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 4 }}>
                        Let CoAI warn you about anomalies, budget risk, and recurring spend.
                      </Text>
                      <Text style={{ color: proactiveAlertsEnabled ? colors.primary : colors.mutedForeground, marginTop: 10 }}>
                        {proactiveAlertsEnabled ? 'Enabled' : 'Disabled'}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={{ marginTop: 24 }}>
                    {renderFooter(t('next') || 'Next', goNext)}
                  </View>
                </View>
              ) : null}

              {step === 'balance' ? (
                <View>
                  <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 999,
                        backgroundColor: colors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                      }}
                    >
                      <Target size={28} color={colors.secondaryForeground} />
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: 'Inter_700Bold' }}>
                      Starting balance
                    </Text>
                    <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>
                      Optional, but useful. A starting balance gives CoAI context immediately.
                    </Text>
                  </View>

                  <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>
                    {t('amount') || 'Amount'} ({selectedCurrency})
                  </Text>
                  <View
                    style={{
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.muted,
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                    }}
                  >
                    <Text style={{ color: colors.mutedForeground, marginEnd: 8 }}>{selectedCurrency}</Text>
                    <TextInput
                      style={{
                        flex: 1,
                        minHeight: 52,
                        color: colors.foreground,
                        fontSize: 18,
                        outlineStyle: 'none',
                      } as any}
                      value={initialBalance}
                      onChangeText={setInitialBalance}
                      placeholder="0.00"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 12, lineHeight: 18 }}>
                    You can create your first budget and goal from CoAI Home immediately after setup.
                  </Text>

                  <View style={{ marginTop: 24 }}>
                    {renderFooter(t('next') || 'Next', goNext)}
                  </View>
                </View>
              ) : null}

              {step === 'complete' ? (
                <View>
                  <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 999,
                        backgroundColor: colors.success + '18',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                      }}
                    >
                      <CheckCircle size={32} color={colors.success} />
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: 'Inter_700Bold' }}>
                      CoAI is ready
                    </Text>
                    <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>
                      CoAI will start with {selectedCurrency}, focus on {focusArea}, and {weeklyBriefEnabled ? 'send weekly briefs' : 'keep weekly briefs off'}.
                    </Text>
                  </View>

                  <View style={{ gap: 12 }}>
                    {[
                      `Preferred currency: ${selectedCurrency}`,
                      `Primary focus: ${focusArea}`,
                      proactiveAlertsEnabled ? 'Proactive alerts enabled' : 'Proactive alerts disabled',
                    ].map((item) => (
                      <View
                        key={item}
                        style={{
                          borderRadius: 12,
                          backgroundColor: colors.secondary,
                          padding: 14,
                        }}
                      >
                        <Text style={{ color: colors.foreground }}>{item}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ marginTop: 24 }}>
                    {renderFooter('Open CoAI Home', finishOnboarding)}
                  </View>
                </View>
              ) : null}
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
