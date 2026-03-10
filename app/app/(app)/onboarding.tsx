import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Wallet, Target, ArrowRight, ArrowLeft } from 'lucide-react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { useAuth } from '../../src/context/AuthContext';
import { useCurrencies } from '../../src/hooks';
import { api } from '../../src/api';
import { Card, Select } from '../../src/components/ui';

type Step = 'welcome' | 'currency' | 'transaction' | 'complete';

const STEPS: Step[] = ['welcome', 'currency', 'transaction', 'complete'];

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
  const [initialBalance, setInitialBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: currencies } = useCurrencies();
  const currentIndex = STEPS.indexOf(step);

  const isLargeScreen = width > 768;
  const formMaxWidth = isLargeScreen ? 500 : '100%';

  const addBalanceMutation = useMutation({
    mutationFn: (data: { currency: string; amount: number; type: 'credit' | 'debit'; category: string; description: string }) =>
      api.wallet.addTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex]);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      // Mark onboarding as complete
      await api.auth.completeOnboarding();
      await refreshProfile();
      router.replace('/(app)/(tabs)/wallet');
    } catch {
      // Continue anyway
      router.replace('/(app)/(tabs)/wallet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      await api.auth.completeOnboarding();
      await refreshProfile();
    } catch {
      // Continue anyway
    }
    router.replace('/(app)/(tabs)/wallet');
  };

  const handleAddInitialBalance = async () => {
    if (!initialBalance || parseFloat(initialBalance) <= 0) {
      handleNext();
      return;
    }

    setIsSubmitting(true);
    try {
      await addBalanceMutation.mutateAsync({
        currency: selectedCurrency,
        amount: parseFloat(initialBalance),
        type: 'credit' as const,
        category: 'income',
        description: 'Initial balance',
      });
      handleNext();
    } catch {
      // Continue anyway
      handleNext();
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencyOptions =
    currencies?.map((c: { code: string; name: string }) => ({
      label: `${c.code} - ${c.name}`,
      value: c.code,
    })) || [];

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
          {/* Progress Bar */}
          <View style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: i <= currentIndex ? colors.primary : colors.muted,
                  }}
                />
              ))}
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              {currentIndex + 1} / {STEPS.length}
            </Text>
          </View>

          <Card style={{ padding: 24 }}>
            {/* Welcome Step */}
            {step === 'welcome' && (
              <View style={{ alignItems: 'center' }}>
                <View style={{ backgroundColor: colors.primary + '33', padding: 24, borderRadius: 9999, marginBottom: 24 }}>
                  <Wallet size={48} color={colors.accent} />
                </View>
                <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 8, textAlign: 'center' }}>
                  {t('welcomeToCoAI') || 'Welcome to CoAI!'}
                </Text>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 32, fontSize: 14 }}>
                  {t('onboardingWelcomeDesc') ||
                    "Set up your wallet in a few quick steps."}
                </Text>
                <View style={{ flexDirection: 'row', gap: 16, width: '100%' }}>
                  <Pressable
                    onPress={handleSkip}
                    style={{ cursor: 'pointer', flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }}>
                      {t('skip') || 'Skip'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleNext}
                    style={{ cursor: 'pointer', flex: 1, backgroundColor: colors.primary, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', marginRight: 8 }}>
                      {t('getStarted') || 'Get Started'}
                    </Text>
                    <ArrowRight size={20} color={colors.primaryForeground} />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Currency Setup Step */}
            {step === 'currency' && (
              <View>
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                  <View style={{ backgroundColor: colors.primary + '33', padding: 16, borderRadius: 9999, marginBottom: 16 }}>
                    <Target size={32} color={colors.accent} />
                  </View>
                  <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 8, textAlign: 'center' }}>
                    {t('selectPrimaryCurrency') || 'Select Your Primary Currency'}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, textAlign: 'center', fontSize: 14 }}>
                    {t('currencySetupDesc') ||
                      'Pick your most-used currency.'}
                  </Text>
                </View>

                <View style={{ marginBottom: 24 }}>
                  <Select
                    value={selectedCurrency}
                    onValueChange={setSelectedCurrency}
                    options={currencyOptions}
                    placeholder="Select currency"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Pressable
                    onPress={handleBack}
                    style={{ cursor: 'pointer', flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ArrowLeft size={20} color={colors.placeholder} />
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginLeft: 8 }}>
                      {t('back') || 'Back'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleNext}
                    style={{ cursor: 'pointer', flex: 1, backgroundColor: colors.primary, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', marginRight: 8 }}>
                      {t('next') || 'Next'}
                    </Text>
                    <ArrowRight size={20} color={colors.primaryForeground} />
                  </Pressable>
                </View>
              </View>
            )}

            {/* First Transaction Step */}
            {step === 'transaction' && (
              <View>
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                  <View style={{ backgroundColor: colors.success + '33', padding: 16, borderRadius: 9999, marginBottom: 16 }}>
                    <Wallet size={32} color={colors.success} />
                  </View>
                  <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 8, textAlign: 'center' }}>
                    {t('addInitialBalance') || 'Add Initial Balance'}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, textAlign: 'center', fontSize: 14 }}>
                    {t('initialBalanceDesc') ||
                      'Add your current balance to get started (optional).'}
                  </Text>
                </View>

                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 8 }}>
                    {t('amount') || 'Amount'} ({selectedCurrency})
                  </Text>
                  <View style={{ backgroundColor: colors.muted, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.mutedForeground, marginRight: 8 }}>{selectedCurrency}</Text>
                    <TextInput
                      style={{ flex: 1, padding: 16, color: colors.foreground, fontSize: 18, outlineStyle: 'none' } as any}
                      placeholder="0.00"
                      placeholderTextColor={colors.placeholder}
                      value={initialBalance}
                      onChangeText={setInitialBalance}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Pressable
                    onPress={handleBack}
                    style={{ cursor: 'pointer', flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ArrowLeft size={20} color={colors.placeholder} />
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginLeft: 8 }}>
                      {t('back') || 'Back'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAddInitialBalance}
                    disabled={isSubmitting}
                    style={{
                      cursor: 'pointer', flex: 1, backgroundColor: colors.primary, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      opacity: isSubmitting ? 0.5 : 1,
                    }}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color={colors.primaryForeground} />
                    ) : (
                      <>
                        <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', marginRight: 8 }}>
                          {initialBalance ? t('addAndContinue') || 'Add & Continue' : t('skip') || 'Skip'}
                        </Text>
                        <ArrowRight size={20} color={colors.primaryForeground} />
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* Complete Step */}
            {step === 'complete' && (
              <View style={{ alignItems: 'center' }}>
                <View style={{ backgroundColor: colors.success + '33', padding: 24, borderRadius: 9999, marginBottom: 24 }}>
                  <CheckCircle size={48} color={colors.success} />
                </View>
                <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 8, textAlign: 'center' }}>
                  {t('setupComplete') || "You're All Set!"}
                </Text>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center', fontSize: 14, marginBottom: 32 }}>
                  {t('setupCompleteDesc') ||
                    'Your wallet is ready — start tracking!'}
                </Text>
                <Pressable
                  onPress={handleComplete}
                  disabled={isSubmitting}
                  style={{
                    cursor: 'pointer', backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12,
                    opacity: isSubmitting ? 0.5 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 18 }}>
                      {t('goToWallet') || 'Go to Wallet'}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
