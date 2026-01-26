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
            <View className="bg-success-light p-6 rounded-xl mb-6">
              <Text className="text-success text-center text-lg">
                {t('resetEmailSent')}
              </Text>
            </View>
            <Text className="text-muted-foreground text-center mb-8">
              {t('checkEmail')}
            </Text>
            <View className="items-center">
              <Link href="/login" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="bg-primary px-6 py-3 rounded-xl">
                  <Text className="text-white font-semibold">{t('backToLogin')}</Text>
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
              <ArrowLeft size={20} color="rgb(148, 163, 184)" />
              <Text className="text-muted-foreground ml-2">{t('backToLogin')}</Text>
            </Pressable>
          </Link>

          <View className="items-center mb-8">
            <Text className="text-3xl font-bold text-foreground mb-2">
              {t('forgotPassword')}
            </Text>
            <Text className="text-muted-foreground text-center">
              {t('forgotPasswordSubtitle')}
            </Text>
          </View>

          {error ? (
            <View className="bg-danger-light p-4 rounded-xl mb-4">
              <Text className="text-danger">{error}</Text>
            </View>
          ) : null}

          <View className="gap-4">
            {/* Email Input */}
            <View className="bg-card rounded-xl flex-row items-center px-4">
              <Mail size={20} color="rgb(148, 163, 184)" />
              <TextInput
                className="flex-1 p-4 text-foreground"
                style={{ outlineStyle: 'none' } as any}
                placeholder={t('email')}
                placeholderTextColor="rgb(148, 163, 184)"
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
              className={`bg-primary p-4 rounded-xl items-center ${isLoading ? 'opacity-50' : ''}`}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-lg">{t('sendResetLink')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
