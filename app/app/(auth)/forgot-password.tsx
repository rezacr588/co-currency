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
import { Link } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, ArrowLeft } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '100%', maxWidth: 400 }}>
            <View style={{ backgroundColor: colors.successMuted, borderWidth: 1, borderColor: colors.success + '33', padding: 20, borderRadius: 8, marginBottom: 24 }}>
              <Text style={{ color: colors.success, textAlign: 'center' }}>
                {t('resetEmailSent')}
              </Text>
            </View>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 32, fontSize: 14 }}>
              {t('checkEmail')}
            </Text>
            <View style={{ alignItems: 'center' }}>
              <Link href="/login" asChild>
                <Pressable style={{ cursor: 'pointer', backgroundColor: colors.foreground, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
                  <Text style={{ color: colors.background, fontFamily: 'Inter_500Medium', fontSize: 14 }}>{t('backToLogin')}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
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
            padding: isDesktop ? 32 : 24,
            paddingBottom: (isDesktop ? 32 : 24) + insets.bottom,
            alignItems: 'center',
          }}
        >
          <View style={{ width: '100%', maxWidth: 400 }}>
          <Link href="/login" asChild>
            <Pressable style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', marginBottom: 32 }}>
              <ArrowLeft size={18} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginLeft: 8, fontSize: 14 }}>{t('backToLogin')}</Text>
            </Pressable>
          </Link>

          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Text style={{ fontSize: 24, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 8 }}>
              {t('forgotPassword')}
            </Text>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', fontSize: 14 }}>
              {t('forgotPasswordSubtitle')}
            </Text>
          </View>

          <FormError message={error} />

          <View style={{ gap: 16 }}>
            {/* Email Input */}
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{t('email')}</Text>
            <View style={{ backgroundColor: colors.muted, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border }}>
              <Mail size={18} color={colors.mutedForeground} />
              <TextInput
                style={{ flex: 1, padding: 14, color: colors.foreground, outlineStyle: 'none', fontSize: 15 } as any}
                placeholder={t('email')}
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>

            {/* Submit Button */}
            <Button variant="accent" isLoading={isLoading} onPress={handleSubmit}>
              {t('sendResetLink')}
            </Button>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
