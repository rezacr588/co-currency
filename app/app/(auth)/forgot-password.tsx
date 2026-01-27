import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, ArrowLeft } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      setError(t('enterEmail'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.auth.forgotPassword({ email });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('requestFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 p-6 justify-center items-center">
          <View style={{ width: '100%', maxWidth: 400 }}>
            <View className="bg-success-muted border border-success/20 p-5 rounded-lg mb-6">
              <Text className="text-success text-center">
                {t('resetEmailSent')}
              </Text>
            </View>
            <Text className="text-muted-foreground text-center mb-8 text-sm">
              {t('checkEmail')}
            </Text>
            <View className="items-center">
              <Link href="/login" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="bg-foreground px-5 py-3 rounded-lg">
                  <Text className="text-background font-medium text-sm">{t('backToLogin')}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: isDesktop ? 32 : 24,
          alignItems: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth: 400 }}>
          <Link href="/login" asChild>
            <Pressable style={{ cursor: 'pointer' }} className="flex-row items-center mb-8">
              <ArrowLeft size={18} color="#71717a" />
              <Text className="text-muted-foreground ml-2 text-sm">{t('backToLogin')}</Text>
            </Pressable>
          </Link>

          <View className="items-center mb-8">
            <Text className="text-2xl font-semibold text-foreground mb-2">
              {t('forgotPassword')}
            </Text>
            <Text className="text-muted-foreground text-center text-sm">
              {t('forgotPasswordSubtitle')}
            </Text>
          </View>

          {error ? (
            <View className="bg-danger-muted border border-danger/20 p-3 rounded-lg mb-4">
              <Text className="text-danger text-sm">{error}</Text>
            </View>
          ) : null}

          <View className="gap-3">
            {/* Email Input */}
            <View className="bg-muted rounded-lg flex-row items-center px-4 border border-border">
              <Mail size={18} color="#71717a" />
              <TextInput
                className="flex-1 p-3.5 text-foreground"
                style={{ outlineStyle: 'none', fontSize: 15 } as any}
                placeholder={t('email')}
                placeholderTextColor="#52525b"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={isLoading}
              style={{ cursor: 'pointer' }}
              className={`bg-accent p-3.5 rounded-lg items-center ${isLoading ? 'opacity-50' : ''}`}
            >
              {isLoading ? (
                <ActivityIndicator color="#09090b" />
              ) : (
                <Text className="text-accent-foreground font-semibold">{t('sendResetLink')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
