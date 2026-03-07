import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, Eye, EyeOff, Lock, XCircle } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { AuthScaffold, Button, FormError, Input } from '../../src/components/ui';

function StatusPanel({
  icon,
  iconColor,
  iconBackground,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBackground: string;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  const theme = useTheme();

  return (
    <AuthScaffold
      title={title}
      subtitle={description}
      footer={(
        <View style={{ alignItems: 'center' }}>
          <Link href={actionHref as any} asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={actionLabel}>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily, fontSize: 14, lineHeight: 20 }}>
                {actionLabel}
              </Text>
            </Pressable>
          </Link>
        </View>
      )}
    >
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            backgroundColor: iconBackground,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.lg,
          }}
        >
          {icon}
        </View>
      </View>
    </AuthScaffold>
  );
}

export default function ResetPasswordScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const token = params.token || '';

  const handleReset = async () => {
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('passwordsDoNotMatch') || 'Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError(t('passwordTooShort') || 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      await api.auth.resetPassword({ token, new_password: newPassword });
      setSuccess(true);
      setTimeout(() => {
        router.replace('/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <StatusPanel
        icon={<XCircle size={36} color={theme.colors.danger} />}
        iconColor={theme.colors.danger}
        iconBackground={theme.colors.dangerMuted}
        title={t('invalidResetLink') || 'Invalid Reset Link'}
        description={t('resetLinkExpired') || 'The password reset link is invalid or has expired.'}
        actionHref="/forgot-password"
        actionLabel={t('requestNewLink') || 'Request New Link'}
      />
    );
  }

  if (success) {
    return (
      <StatusPanel
        icon={<CheckCircle size={36} color={theme.colors.success} />}
        iconColor={theme.colors.success}
        iconBackground={theme.colors.successMuted}
        title={t('passwordResetSuccess') || 'Password Reset Successful'}
        description={t('redirectingToLogin') || 'Your password has been reset. Redirecting to login...'}
        actionHref="/login"
        actionLabel={t('goToLogin') || 'Go to Login'}
      />
    );
  }

  return (
    <AuthScaffold
      title={t('resetPassword') || 'Reset Password'}
      subtitle={t('enterNewPassword') || 'Enter your new password'}
      footer={(
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>
            {t('rememberYourPassword') || 'Remember your password? '}
          </Text>
          <Link href="/login" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={t('login')}>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily, fontSize: 14, lineHeight: 20 }}>
                {t('login')}
              </Text>
            </Pressable>
          </Link>
        </View>
      )}
    >
      <FormError message={error} />

      <View style={{ gap: theme.spacing.lg }}>
        <Input
          placeholder={t('newPassword') || 'New Password'}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!isLoading}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          leftIcon={<Lock size={18} color={theme.colors.mutedForeground} />}
          rightIcon={(
            <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={6}>
              {showPassword ? <EyeOff size={18} color={theme.colors.mutedForeground} /> : <Eye size={18} color={theme.colors.mutedForeground} />}
            </Pressable>
          )}
          style={{ fontSize: 15, outlineStyle: 'none' } as any}
        />

        <Input
          placeholder={t('confirmPassword') || 'Confirm Password'}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!isLoading}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          leftIcon={<Lock size={18} color={theme.colors.mutedForeground} />}
          style={{ fontSize: 15, outlineStyle: 'none' } as any}
        />

        <Button isLoading={isLoading} onPress={handleReset}>
          {t('resetPassword') || 'Reset Password'}
        </Button>
      </View>
    </AuthScaffold>
  );
}
