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
import { ChevronLeft, Lock, Eye, EyeOff, Check } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useAuth } from '../../src/context/AuthContext';
import { useToast } from '../../src/components/ui/Toast';

export default function ChangePasswordScreen() {
  const { t } = useLanguage();
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
    } else if (newPassword.length < 6) {
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
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => router.back()}
            style={{ cursor: 'pointer' }}
            className="p-2 mr-2"
          >
            <ChevronLeft size={24} color="rgb(148, 163, 184)" />
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">{t('changePassword')}</Text>
        </View>

        {/* Form */}
        <View className="bg-card p-6 rounded-xl">
          <View className="w-16 h-16 bg-primary/20 rounded-full items-center justify-center self-center mb-6">
            <Lock size={32} color="rgb(212, 175, 55)" />
          </View>

          <Text className="text-muted-foreground text-center mb-6">
            {hasPassword
              ? t('changePasswordDescription')
              : t('setPasswordDescription')}
          </Text>

          {/* Current Password */}
          {hasPassword && (
            <View className="mb-4">
              <Text className="text-sm text-muted-foreground mb-2">
                {t('currentPassword')}
              </Text>
              <View className="bg-background rounded-xl flex-row items-center px-4">
                <Lock size={20} color="rgb(148, 163, 184)" />
                <TextInput
                  className="flex-1 py-4 ml-3 text-foreground"
                  value={currentPassword}
                  onChangeText={(text) => {
                    setCurrentPassword(text);
                    if (errors.currentPassword) {
                      setErrors({ ...errors, currentPassword: undefined });
                    }
                  }}
                  placeholder={t('enterCurrentPassword')}
                  placeholderTextColor="rgb(148, 163, 184)"
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  style={{ outlineStyle: 'none' } as any}
                />
                <Pressable
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={{ cursor: 'pointer' }}
                >
                  {showCurrentPassword ? (
                    <EyeOff size={20} color="rgb(148, 163, 184)" />
                  ) : (
                    <Eye size={20} color="rgb(148, 163, 184)" />
                  )}
                </Pressable>
              </View>
              {errors.currentPassword && (
                <Text className="text-danger text-sm mt-1">{errors.currentPassword}</Text>
              )}
            </View>
          )}

          {/* New Password */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground mb-2">{t('newPassword')}</Text>
            <View className="bg-background rounded-xl flex-row items-center px-4">
              <Lock size={20} color="rgb(148, 163, 184)" />
              <TextInput
                className="flex-1 py-4 ml-3 text-foreground"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (errors.newPassword) {
                    setErrors({ ...errors, newPassword: undefined });
                  }
                }}
                placeholder={t('enterNewPassword')}
                placeholderTextColor="rgb(148, 163, 184)"
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                style={{ outlineStyle: 'none' } as any}
              />
              <Pressable
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={{ cursor: 'pointer' }}
              >
                {showNewPassword ? (
                  <EyeOff size={20} color="rgb(148, 163, 184)" />
                ) : (
                  <Eye size={20} color="rgb(148, 163, 184)" />
                )}
              </Pressable>
            </View>
            {errors.newPassword && (
              <Text className="text-danger text-sm mt-1">{errors.newPassword}</Text>
            )}
          </View>

          {/* Confirm Password */}
          <View className="mb-6">
            <Text className="text-sm text-muted-foreground mb-2">
              {t('confirmPassword')}
            </Text>
            <View className="bg-background rounded-xl flex-row items-center px-4">
              <Lock size={20} color="rgb(148, 163, 184)" />
              <TextInput
                className="flex-1 py-4 ml-3 text-foreground"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: undefined });
                  }
                }}
                placeholder={t('confirmYourPassword')}
                placeholderTextColor="rgb(148, 163, 184)"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                style={{ outlineStyle: 'none' } as any}
              />
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ cursor: 'pointer' }}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color="rgb(148, 163, 184)" />
                ) : (
                  <Eye size={20} color="rgb(148, 163, 184)" />
                )}
              </Pressable>
            </View>
            {errors.confirmPassword && (
              <Text className="text-danger text-sm mt-1">{errors.confirmPassword}</Text>
            )}
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={changePasswordMutation.isPending}
            className={`bg-primary p-4 rounded-xl flex-row items-center justify-center ${
              changePasswordMutation.isPending ? 'opacity-50' : ''
            }`}
            style={{ cursor: 'pointer' }}
          >
            {changePasswordMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Check size={20} color="white" />
                <Text className="text-white font-semibold ml-2">
                  {hasPassword ? t('changePassword') : t('setPassword')}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Password Requirements */}
        <View className="mt-4 p-4 bg-card rounded-xl">
          <Text className="text-sm font-medium text-foreground mb-2">
            {t('passwordRequirements')}
          </Text>
          <View style={{ gap: 4 }}>
            <Text className="text-sm text-muted-foreground">
              - {t('passwordMinLength')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
