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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          alignItems: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth: formMaxWidth }}>
          {/* Progress Indicator */}
          <View className="flex-row items-center justify-center mb-8">
            {STEPS.map((s, i) => (
              <View key={s} className="flex-row items-center">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    i <= currentIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      i <= currentIndex ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </Text>
                </View>
                {i < STEPS.length - 1 && (
                  <View
                    className={`w-12 h-1 mx-2 ${
                      i < currentIndex ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </View>
            ))}
          </View>

          <Card className="p-6">
            {/* Welcome Step */}
            {step === 'welcome' && (
              <View className="items-center">
                <View className="bg-primary/20 p-6 rounded-full mb-6">
                  <Wallet size={48} color="rgb(212, 175, 55)" />
                </View>
                <Text className="text-2xl font-bold text-foreground mb-2 text-center">
                  {t('welcomeToCoFinance') || 'Welcome to CoFinance!'}
                </Text>
                <Text className="text-muted-foreground text-center mb-8">
                  {t('onboardingWelcomeDesc') ||
                    "Let's set up your wallet in a few quick steps."}
                </Text>
                <View className="flex-row gap-4 w-full">
                  <Pressable
                    onPress={handleSkip}
                    style={{ cursor: 'pointer' }}
                    className="flex-1 p-4 rounded-xl border border-border items-center"
                  >
                    <Text className="text-muted-foreground font-medium">
                      {t('skip') || 'Skip'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleNext}
                    style={{ cursor: 'pointer' }}
                    className="flex-1 bg-primary p-4 rounded-xl flex-row items-center justify-center"
                  >
                    <Text className="text-primary-foreground font-semibold mr-2">
                      {t('getStarted') || 'Get Started'}
                    </Text>
                    <ArrowRight size={20} color="#09090b" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Currency Setup Step */}
            {step === 'currency' && (
              <View>
                <View className="items-center mb-6">
                  <View className="bg-primary/20 p-4 rounded-full mb-4">
                    <Target size={32} color="rgb(212, 175, 55)" />
                  </View>
                  <Text className="text-xl font-bold text-foreground mb-2 text-center">
                    {t('selectPrimaryCurrency') || 'Select Your Primary Currency'}
                  </Text>
                  <Text className="text-muted-foreground text-center">
                    {t('currencySetupDesc') ||
                      'Choose the currency you use most often.'}
                  </Text>
                </View>

                <View className="mb-6">
                  <Select
                    value={selectedCurrency}
                    onValueChange={setSelectedCurrency}
                    options={currencyOptions}
                    placeholder="Select currency"
                  />
                </View>

                <View className="flex-row gap-4">
                  <Pressable
                    onPress={handleBack}
                    style={{ cursor: 'pointer' }}
                    className="flex-1 p-4 rounded-xl border border-border flex-row items-center justify-center"
                  >
                    <ArrowLeft size={20} color="rgb(148, 163, 184)" />
                    <Text className="text-muted-foreground font-medium ml-2">
                      {t('back') || 'Back'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleNext}
                    style={{ cursor: 'pointer' }}
                    className="flex-1 bg-primary p-4 rounded-xl flex-row items-center justify-center"
                  >
                    <Text className="text-primary-foreground font-semibold mr-2">
                      {t('next') || 'Next'}
                    </Text>
                    <ArrowRight size={20} color="#09090b" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* First Transaction Step */}
            {step === 'transaction' && (
              <View>
                <View className="items-center mb-6">
                  <View className="bg-success/20 p-4 rounded-full mb-4">
                    <Wallet size={32} color="rgb(16, 185, 129)" />
                  </View>
                  <Text className="text-xl font-bold text-foreground mb-2 text-center">
                    {t('addInitialBalance') || 'Add Initial Balance'}
                  </Text>
                  <Text className="text-muted-foreground text-center">
                    {t('initialBalanceDesc') ||
                      'Start tracking by adding your current balance (optional).'}
                  </Text>
                </View>

                <View className="mb-6">
                  <Text className="text-sm text-muted-foreground mb-2">
                    {t('amount') || 'Amount'} ({selectedCurrency})
                  </Text>
                  <View className="bg-muted rounded-xl flex-row items-center px-4 border border-border">
                    <Text className="text-muted-foreground mr-2">{selectedCurrency}</Text>
                    <TextInput
                      className="flex-1 p-4 text-foreground text-lg"
                      style={{ outlineStyle: 'none' } as any}
                      placeholder="0.00"
                      placeholderTextColor="rgb(148, 163, 184)"
                      value={initialBalance}
                      onChangeText={setInitialBalance}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <View className="flex-row gap-4">
                  <Pressable
                    onPress={handleBack}
                    style={{ cursor: 'pointer' }}
                    className="flex-1 p-4 rounded-xl border border-border flex-row items-center justify-center"
                  >
                    <ArrowLeft size={20} color="rgb(148, 163, 184)" />
                    <Text className="text-muted-foreground font-medium ml-2">
                      {t('back') || 'Back'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAddInitialBalance}
                    disabled={isSubmitting}
                    style={{ cursor: 'pointer' }}
                    className={`flex-1 bg-primary p-4 rounded-xl flex-row items-center justify-center ${
                      isSubmitting ? 'opacity-50' : ''
                    }`}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#09090b" />
                    ) : (
                      <>
                        <Text className="text-primary-foreground font-semibold mr-2">
                          {initialBalance ? t('addAndContinue') || 'Add & Continue' : t('skip') || 'Skip'}
                        </Text>
                        <ArrowRight size={20} color="#09090b" />
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* Complete Step */}
            {step === 'complete' && (
              <View className="items-center">
                <View className="bg-success/20 p-6 rounded-full mb-6">
                  <CheckCircle size={48} color="rgb(16, 185, 129)" />
                </View>
                <Text className="text-2xl font-bold text-foreground mb-2 text-center">
                  {t('setupComplete') || "You're All Set!"}
                </Text>
                <Text className="text-muted-foreground text-center mb-8">
                  {t('setupCompleteDesc') ||
                    'Your wallet is ready. Start tracking your finances!'}
                </Text>
                <Pressable
                  onPress={handleComplete}
                  disabled={isSubmitting}
                  style={{ cursor: 'pointer' }}
                  className={`bg-primary px-8 py-4 rounded-xl ${isSubmitting ? 'opacity-50' : ''}`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#09090b" />
                  ) : (
                    <Text className="text-primary-foreground font-semibold text-lg">
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
