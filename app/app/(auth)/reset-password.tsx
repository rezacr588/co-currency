import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { api } from '../../src/api';

export default function ResetPasswordScreen() {
  const { t } = useLanguage();
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
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
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
            <View className="bg-card p-8 rounded-2xl items-center">
              <View className="bg-danger/20 p-4 rounded-full mb-4">
                <XCircle size={40} color="rgb(220, 38, 38)" />
              </View>
              <Text className="text-xl font-bold text-foreground mb-2 text-center">
                Invalid Reset Link
              </Text>
              <Text className="text-muted-foreground text-center mb-6">
                The password reset link is invalid or has expired.
              </Text>
              <Link href="/forgot-password" asChild>
                <Pressable
                  style={{ cursor: 'pointer' }}
                  className="bg-primary px-6 py-3 rounded-xl"
                >
                  <Text className="text-primary-foreground font-semibold">Request New Link</Text>
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
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
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
            <View className="bg-card p-8 rounded-2xl items-center">
              <View className="bg-success/20 p-4 rounded-full mb-4">
                <CheckCircle size={40} color="rgb(16, 185, 129)" />
              </View>
              <Text className="text-xl font-bold text-foreground mb-2 text-center">
                Password Reset Successful
              </Text>
              <Text className="text-muted-foreground text-center mb-6">
                Your password has been reset. Redirecting to login...
              </Text>
              <Link href="/login" asChild>
                <Pressable
                  style={{ cursor: 'pointer' }}
                  className="bg-primary px-6 py-3 rounded-xl"
                >
                  <Text className="text-primary-foreground font-semibold">Go to Login</Text>
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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
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
          <View className="items-center mb-8">
            <Text className="text-3xl font-bold text-foreground mb-2">
              {t('resetPassword') || 'Reset Password'}
            </Text>
            <Text className="text-muted-foreground text-center">
              Enter your new password
            </Text>
          </View>

          {error ? (
            <View className="bg-danger/10 p-4 rounded-xl mb-4">
              <Text className="text-danger">{error}</Text>
            </View>
          ) : null}

          <View className="gap-4">
            {/* New Password Input */}
            <View className="bg-card rounded-xl flex-row items-center px-4 border border-border">
              <Lock size={20} color="rgb(148, 163, 184)" />
              <TextInput
                className="flex-1 p-4 text-foreground"
                style={{ outlineStyle: 'none', fontSize: 16 } as any}
                placeholder={t('newPassword') || 'New Password'}
                placeholderTextColor="rgb(148, 163, 184)"
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
                  <EyeOff size={20} color="rgb(148, 163, 184)" />
                ) : (
                  <Eye size={20} color="rgb(148, 163, 184)" />
                )}
              </Pressable>
            </View>

            {/* Confirm Password Input */}
            <View className="bg-card rounded-xl flex-row items-center px-4 border border-border">
              <Lock size={20} color="rgb(148, 163, 184)" />
              <TextInput
                className="flex-1 p-4 text-foreground"
                style={{ outlineStyle: 'none', fontSize: 16 } as any}
                placeholder={t('confirmPassword') || 'Confirm Password'}
                placeholderTextColor="rgb(148, 163, 184)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            {/* Reset Button */}
            <Pressable
              onPress={handleReset}
              disabled={isLoading}
              style={{ cursor: 'pointer' }}
              className={`bg-primary p-4 rounded-xl items-center ${isLoading ? 'opacity-50' : ''}`}
            >
              {isLoading ? (
                <ActivityIndicator color="#09090b" />
              ) : (
                <Text className="text-primary-foreground font-semibold text-lg">
                  {t('resetPassword') || 'Reset Password'}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Back to Login */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-muted-foreground">Remember your password? </Text>
            <Link href="/login" asChild>
              <Pressable style={{ cursor: 'pointer' }}>
                <Text className="text-accent font-semibold">{t('login')}</Text>
              </Pressable>
            </Link>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
