import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Lock, Eye, EyeOff, Check } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from 'styled-components/native';
import { useToast } from '../../src/components/ui/Toast';
import { Button } from '../../src/components/ui/Button';

export default function ChangePasswordScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Check if user has a password (not OAuth-only)
  const hasPassword = user?.has_password !== false;

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      api.auth.changePassword({
        current_password: hasPassword ? currentPassword : undefined,
        new_password: newPassword,
      }),
    onSuccess: () => {
      showToast(hasPassword ? t('passwordUpdated') : t('passwordSet'), 'success');
      router.back();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t('passwordUpdateFailed');
      if (message.toLowerCase().includes('current')) {
        setErrors({ currentPassword: t('currentPasswordIncorrect') });
      } else {
        showToast(message, 'error');
      }
    },
  });

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (hasPassword && !currentPassword) {
      newErrors.currentPassword = t('currentPasswordRequired');
    }

    if (!newPassword) {
      newErrors.newPassword = t('newPasswordRequired');
    } else if (newPassword.length < 8) {
      newErrors.newPassword = t('passwordTooShort');
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t('confirmPasswordRequired');
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('passwordsDoNotMatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      changePasswordMutation.mutate();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ cursor: 'pointer', padding: 8, marginEnd: 8 }}
          >
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('changePassword')}</Text>
        </View>

        {/* Form */}
        <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12 }}>
          <View style={{ width: 64, height: 64, backgroundColor: colors.primary + '33', borderRadius: 9999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 24 }}>
            <Lock size={32} color={colors.accent} />
          </View>

          <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 24 }}>
            {hasPassword
              ? t('changePasswordDescription')
              : t('setPasswordDescription')}
          </Text>

          {/* Current Password */}
          {hasPassword && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 8 }}>
                {t('currentPassword')}
              </Text>
              <View style={{ backgroundColor: colors.background, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                <Lock size={20} color={colors.placeholder} />
                <TextInput
                  style={{ flex: 1, paddingVertical: 16, marginStart: 12, color: colors.foreground, outlineStyle: 'none' } as any}
                  value={currentPassword}
                  onChangeText={(text) => {
                    setCurrentPassword(text);
                    if (errors.currentPassword) {
                      setErrors({ ...errors, currentPassword: undefined });
                    }
                  }}
                  placeholder={t('enterCurrentPassword')}
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={{ cursor: 'pointer' }}
                >
                  {showCurrentPassword ? (
                    <EyeOff size={20} color={colors.placeholder} />
                  ) : (
                    <Eye size={20} color={colors.placeholder} />
                  )}
                </Pressable>
              </View>
              {errors.currentPassword && (
                <Text style={{ color: colors.danger, fontSize: 14, marginTop: 4 }}>{errors.currentPassword}</Text>
              )}
            </View>
          )}

          {/* New Password */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 8 }}>{t('newPassword')}</Text>
            <View style={{ backgroundColor: colors.background, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
              <Lock size={20} color={colors.placeholder} />
              <TextInput
                style={{ flex: 1, paddingVertical: 16, marginStart: 12, color: colors.foreground, outlineStyle: 'none' } as any}
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (errors.newPassword) {
                    setErrors({ ...errors, newPassword: undefined });
                  }
                }}
                placeholder={t('enterNewPassword')}
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={{ cursor: 'pointer' }}
              >
                {showNewPassword ? (
                  <EyeOff size={20} color={colors.placeholder} />
                ) : (
                  <Eye size={20} color={colors.placeholder} />
                )}
              </Pressable>
            </View>
            {errors.newPassword && (
              <Text style={{ color: colors.danger, fontSize: 14, marginTop: 4 }}>{errors.newPassword}</Text>
            )}
          </View>

          {/* Confirm Password */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 8 }}>
              {t('confirmPassword')}
            </Text>
            <View style={{ backgroundColor: colors.background, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
              <Lock size={20} color={colors.placeholder} />
              <TextInput
                style={{ flex: 1, paddingVertical: 16, marginStart: 12, color: colors.foreground, outlineStyle: 'none' } as any}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: undefined });
                  }
                }}
                placeholder={t('confirmYourPassword')}
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ cursor: 'pointer' }}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color={colors.placeholder} />
                ) : (
                  <Eye size={20} color={colors.placeholder} />
                )}
              </Pressable>
            </View>
            {errors.confirmPassword && (
              <Text style={{ color: colors.danger, fontSize: 14, marginTop: 4 }}>{errors.confirmPassword}</Text>
            )}
          </View>

          {/* Submit Button */}
          <Button
            variant="primary"
            onPress={handleSubmit}
            isLoading={changePasswordMutation.isPending}
            leftIcon={<Check size={20} color={colors.primaryForeground} />}
          >
            {hasPassword ? t('changePassword') : t('setPassword')}
          </Button>
        </View>

        {/* Password Requirements */}
        <View style={{ marginTop: 16, padding: 16, backgroundColor: colors.card, borderRadius: 12 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground, marginBottom: 8 }}>
            {t('passwordRequirements')}
          </Text>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
              - {t('passwordMinLength')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
