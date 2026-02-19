import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';

export default function ResetPasswordScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isLargeScreen = width > 768;
  const formMaxWidth = isLargeScreen ? 400 : '100%';

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

  // Invalid token state
  if (!token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
              paddingBottom: 24 + insets.bottom,
            }}
          >
            <View style={{ width: '100%', maxWidth: formMaxWidth }}>
            <View style={{ backgroundColor: colors.card, padding: 32, borderRadius: 16, alignItems: 'center' }}>
              <View style={{ backgroundColor: colors.danger + '33', padding: 16, borderRadius: 9999, marginBottom: 16 }}>
                <XCircle size={40} color={colors.danger} />
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 8, textAlign: 'center' }}>
                Invalid Reset Link
              </Text>
              <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 24 }}>
                The password reset link is invalid or has expired.
              </Text>
              <Link href="/forgot-password" asChild>
                <Pressable
                  style={{ cursor: 'pointer', backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                >
                  <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>Request New Link</Text>
                </Pressable>
              </Link>
            </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Success state
  if (success) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
              paddingBottom: 24 + insets.bottom,
            }}
          >
            <View style={{ width: '100%', maxWidth: formMaxWidth }}>
            <View style={{ backgroundColor: colors.card, padding: 32, borderRadius: 16, alignItems: 'center' }}>
              <View style={{ backgroundColor: colors.success + '33', padding: 16, borderRadius: 9999, marginBottom: 16 }}>
                <CheckCircle size={40} color={colors.success} />
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 8, textAlign: 'center' }}>
                Password Reset Successful
              </Text>
              <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 24 }}>
                Your password has been reset. Redirecting to login...
              </Text>
              <Link href="/login" asChild>
                <Pressable
                  style={{ cursor: 'pointer', backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                >
                  <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>Go to Login</Text>
                </Pressable>
              </Link>
            </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            paddingBottom: 24 + insets.bottom,
          }}
        >
          <View style={{ width: '100%', maxWidth: formMaxWidth }}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Text style={{ fontSize: 30, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 8 }}>
              {t('resetPassword') || 'Reset Password'}
            </Text>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
              Enter your new password
            </Text>
          </View>

          <FormError message={error} />

          <View style={{ gap: 16 }}>
            {/* New Password Input */}
            <View style={{ backgroundColor: colors.card, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border }}>
              <Lock size={20} color={colors.placeholder} />
              <TextInput
                style={{ flex: 1, padding: 16, color: colors.foreground, outlineStyle: 'none', fontSize: 16 } as any}
                placeholder={t('newPassword') || 'New Password'}
                placeholderTextColor={colors.placeholder}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={{ cursor: 'pointer', padding: 4 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.placeholder} />
                ) : (
                  <Eye size={20} color={colors.placeholder} />
                )}
              </Pressable>
            </View>

            {/* Confirm Password Input */}
            <View style={{ backgroundColor: colors.card, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border }}>
              <Lock size={20} color={colors.placeholder} />
              <TextInput
                style={{ flex: 1, padding: 16, color: colors.foreground, outlineStyle: 'none', fontSize: 16 } as any}
                placeholder={t('confirmPassword') || 'Confirm Password'}
                placeholderTextColor={colors.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            {/* Reset Button */}
            <Button variant="primary" size="lg" isLoading={isLoading} onPress={handleReset}>
              {t('resetPassword') || 'Reset Password'}
            </Button>
          </View>

          {/* Back to Login */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32 }}>
            <Text style={{ color: colors.mutedForeground }}>Remember your password? </Text>
            <Link href="/login" asChild>
              <Pressable style={{ cursor: 'pointer' }}>
                <Text style={{ color: colors.accent, fontFamily: 'Inter_600SemiBold' }}>{t('login')}</Text>
              </Pressable>
            </Link>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
