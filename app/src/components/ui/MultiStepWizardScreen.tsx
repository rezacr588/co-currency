import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'styled-components/native';
import { useScreenLayout } from '../../hooks/useScreenLayout';

export interface MultiStepWizardItem {
  key: string;
  label: string;
  shortLabel?: string;
}

interface MultiStepWizardScreenProps {
  eyebrow?: string;
  title: string;
  steps: MultiStepWizardItem[];
  activeStep: string;
  onStepPress: (stepKey: string) => void;
  onClose: () => void;
  onDiscard: () => void;
  onBack: () => void;
  onPrimaryAction: () => void;
  primaryLabel: string;
  isPrimaryLoading?: boolean;
  isPrimaryDisabled?: boolean;
  canGoBack?: boolean;
  discardAccessibilityLabel?: string;
  closeLabel?: string;
  backLabel?: string;
  children: ReactNode;
}

interface WizardStepJumpChipsProps {
  items: MultiStepWizardItem[];
  onPress: (stepKey: string) => void;
}

export function WizardStepJumpChips({ items, onPress }: WizardStepJumpChipsProps) {
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onPress(item.key)}
          style={({ pressed }) => [{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: colors.background,
          }, pressed && { opacity: 0.72 }]}
        >
          <Text style={{ color: colors.foreground, fontSize: 11 }}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MultiStepWizardScreen({
  eyebrow,
  title,
  steps,
  activeStep,
  onStepPress,
  onClose,
  onDiscard,
  onBack,
  onPrimaryAction,
  primaryLabel,
  isPrimaryLoading = false,
  isPrimaryDisabled = false,
  canGoBack = true,
  discardAccessibilityLabel = 'Discard draft',
  closeLabel = 'Close',
  backLabel = 'Back',
  children,
}: MultiStepWizardScreenProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const { width, isCompactPhone, isPhone } = useScreenLayout();
  const activeStepIndex = Math.max(steps.findIndex((step) => step.key === activeStep), 0);
  const currentStepNumber = activeStepIndex + 1;
  const isFinalStep = activeStepIndex >= steps.length - 1;
  const pageMaxWidth = width >= 1280 ? 1080 : width >= 960 ? 960 : 880;
  const shellPaddingX = isCompactPhone ? 12 : isPhone ? 16 : 24;
  const shellPaddingBottom = Math.max(insets.bottom + (isPhone ? 8 : 12), isPhone ? 16 : 20);
  const heroRadius = isPhone ? 18 : 24;
  const cardRadius = isPhone ? 24 : 28;
  const heroPaddingX = isCompactPhone ? 14 : isPhone ? 16 : 20;
  const heroPaddingY = isCompactPhone ? 10 : isPhone ? 12 : 16;
  const mobileStepWidth = isCompactPhone ? 116 : 132;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.background, colors.backgroundSecondary, colors.background]} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, paddingHorizontal: shellPaddingX, paddingTop: isPhone ? 8 : 10, paddingBottom: shellPaddingBottom }}>
            <View style={{ width: '100%', maxWidth: pageMaxWidth, alignSelf: 'center', flex: 1 }}>
              <View
                style={{
                  overflow: 'hidden',
                  borderRadius: heroRadius,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: isPhone ? 12 : 16,
                  shadowColor: colors.accent,
                  shadowOpacity: 0.16,
                  shadowRadius: isPhone ? 14 : 20,
                  shadowOffset: { width: 0, height: isPhone ? 6 : 10 },
                  elevation: isPhone ? 3 : 5,
                }}
              >
                <LinearGradient
                  colors={[colors.accent + '2A', colors.card, colors.backgroundSecondary]}
                  style={{ paddingHorizontal: heroPaddingX, paddingVertical: heroPaddingY }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: isPhone ? 8 : 12 }}>
                    <Pressable
                      onPress={onClose}
                      hitSlop={8}
                      accessibilityRole="button"
                      testID="wizard-close-action"
                      style={({ pressed }) => [{
                        minHeight: isPhone ? 38 : 42,
                        borderRadius: 999,
                        paddingHorizontal: isCompactPhone ? 12 : 14,
                        paddingVertical: isPhone ? 8 : 9,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.background + 'E6',
                        borderWidth: 1,
                        borderColor: colors.border,
                      }, pressed && { opacity: 0.72 }]}
                    >
                      <ArrowLeft size={16} color={colors.foreground} />
                      {!isCompactPhone && (
                        <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold', marginStart: 8 }}>
                          {closeLabel}
                        </Text>
                      )}
                    </Pressable>

                    <View
                      style={{
                        minHeight: isPhone ? 38 : 42,
                        borderRadius: 999,
                        paddingHorizontal: isCompactPhone ? 12 : 14,
                        paddingVertical: isPhone ? 8 : 9,
                        backgroundColor: colors.foreground,
                      }}
                    >
                      <Text style={{ color: colors.background, fontSize: 13, fontFamily: 'Inter_700Bold' }}>
                        {currentStepNumber} / {steps.length}
                      </Text>
                    </View>
                  </View>

                  {!isPhone && (
                    <>
                      {eyebrow ? (
                        <Text style={{ color: colors.accent, fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                          {eyebrow}
                        </Text>
                      ) : null}
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 28, marginTop: eyebrow ? 6 : 0 }}>
                        {title}
                      </Text>
                    </>
                  )}

                  {isPhone ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={{ gap: 8, marginTop: isPhone ? 6 : 16, paddingEnd: 4 }}
                    >
                      {steps.map((step, index) => {
                        const active = step.key === activeStep;
                        const completed = currentStepNumber - 1 > index;
                        const stepLabel = step.shortLabel || step.label;
                        return (
                          <Pressable
                            key={step.key}
                            onPress={() => onStepPress(step.key)}
                            style={{ width: mobileStepWidth }}
                            testID={`wizard-step-${step.key}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                          >
                            <View
                              testID={`wizard-step-card-${step.key}`}
                              style={{
                                minHeight: 46,
                                borderRadius: 16,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                gap: 6,
                                borderWidth: 1,
                                borderColor: active ? colors.foreground : completed ? colors.success + '55' : colors.border,
                                backgroundColor: active ? colors.foreground : completed ? colors.success + '16' : colors.background + 'E8',
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: active ? colors.accent : completed ? colors.success : colors.muted,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: active ? colors.accentForeground : completed ? '#fff' : colors.mutedForeground,
                                      fontSize: 11,
                                      fontFamily: 'Inter_700Bold',
                                    }}
                                  >
                                    {index + 1}
                                  </Text>
                                </View>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    flex: 1,
                                    fontSize: isCompactPhone ? 10 : 11,
                                    color: active ? colors.background : completed ? colors.success : colors.foreground,
                                    fontFamily: active ? 'Inter_700Bold' : 'Inter_600SemiBold',
                                  }}
                                >
                                  {stepLabel}
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 4 }}>
                      {steps.map((step, index) => {
                        const active = step.key === activeStep;
                        const completed = currentStepNumber - 1 > index;
                        return (
                          <Pressable
                            key={step.key}
                            onPress={() => onStepPress(step.key)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                            testID={`wizard-step-${step.key}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                          >
                            <View
                              testID={`wizard-step-card-${step.key}`}
                              style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: active ? colors.foreground : completed ? colors.success + '20' : colors.background + 'E8',
                                borderWidth: 1,
                                borderColor: active ? colors.foreground : completed ? colors.success + '55' : colors.border,
                                borderRadius: 16,
                                paddingHorizontal: 10,
                                paddingVertical: 10,
                                gap: 8,
                              }}
                            >
                              <View
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 12,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: active ? colors.accent : completed ? colors.success : colors.muted,
                                }}
                              >
                                <Text
                                  style={{
                                    color: active ? colors.accentForeground : completed ? '#fff' : colors.mutedForeground,
                                    fontSize: 11,
                                    fontFamily: 'Inter_700Bold',
                                  }}
                                >
                                  {index + 1}
                                </Text>
                              </View>
                              <Text
                                numberOfLines={1}
                                style={{
                                  flex: 1,
                                  fontSize: 11,
                                  color: active ? colors.background : completed ? colors.success : colors.foreground,
                                  fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                                }}
                              >
                                {step.label}
                              </Text>
                            </View>
                            {index < steps.length - 1 ? (
                              <ChevronRight size={12} color={colors.border} style={{ marginHorizontal: 1 }} />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </LinearGradient>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderRadius: cardRadius,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: isCompactPhone ? 14 : isPhone ? 16 : 20,
                  paddingTop: isPhone ? 14 : 18,
                  paddingBottom: isPhone ? 12 : 14,
                }}
              >
                <View style={{ marginBottom: isPhone ? 10 : 14 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {currentStepNumber} of {steps.length}
                  </Text>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: isPhone ? 18 : 22, marginTop: 4 }}>
                    {title}
                  </Text>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: isPhone ? 16 : 12 }}
                >
                  {children}
                </ScrollView>

                <View style={{ height: 1, backgroundColor: colors.border, marginTop: isPhone ? 10 : 14, marginBottom: isPhone ? 10 : 12 }} />

                <View style={{ flexDirection: 'row', gap: isCompactPhone ? 6 : 8, alignItems: 'center' }}>
                  <Pressable
                    onPress={onDiscard}
                    hitSlop={4}
                    accessibilityLabel={discardAccessibilityLabel}
                    accessibilityRole="button"
                    testID="wizard-discard-action"
                    style={({ pressed }) => [{
                      borderRadius: isPhone ? 14 : 16,
                      borderWidth: 1,
                      borderColor: colors.danger + '44',
                      backgroundColor: colors.danger + '10',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: isPhone ? 13 : 14,
                      paddingHorizontal: isPhone ? 14 : 16,
                      minWidth: isPhone ? 48 : 52,
                      minHeight: isPhone ? 48 : 52,
                    }, pressed && { opacity: 0.72 }]}
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </Pressable>

                  <Pressable
                    onPress={onBack}
                    disabled={!canGoBack}
                    testID="wizard-back-action"
                    style={({ pressed }) => [{
                      flex: 1,
                      borderRadius: isPhone ? 14 : 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.backgroundSecondary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: isPhone ? 13 : 14,
                      opacity: !canGoBack ? 0.45 : pressed ? 0.72 : 1,
                    }]}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
                      {backLabel}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={onPrimaryAction}
                    disabled={isPrimaryLoading || isPrimaryDisabled}
                    testID="wizard-primary-action"
                    style={({ pressed }) => [{
                      flex: 1.5,
                      borderRadius: isPhone ? 14 : 16,
                      backgroundColor: isFinalStep ? colors.accent : colors.foreground,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: isPhone ? 13 : 14,
                      shadowColor: isFinalStep ? colors.accent : colors.foreground,
                      shadowOpacity: isFinalStep ? 0.34 : 0.18,
                      shadowRadius: isFinalStep ? 14 : 16,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 4,
                      opacity: (isPrimaryLoading || isPrimaryDisabled) ? 0.6 : pressed ? 0.78 : 1,
                    }]}
                  >
                    {isPrimaryLoading ? (
                      <ActivityIndicator size="small" color={isFinalStep ? colors.accentForeground : colors.background} />
                    ) : (
                      <Text
                        style={{
                          color: isFinalStep ? colors.accentForeground : colors.background,
                          fontFamily: 'Inter_700Bold',
                          fontSize: 14,
                        }}
                      >
                        {primaryLabel}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}
