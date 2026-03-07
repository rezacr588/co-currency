import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { AuthScaffold, Button, FormError, Input } from '../../src/components/ui';

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
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
      <AuthScaffold
        title={t('forgotPassword')}
        subtitle={t('checkEmail')}
        footer={(
          <View style={{ alignItems: 'center' }}>
            <Link href="/login" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={t('backToLogin')}>
                <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily, fontSize: 14, lineHeight: 20 }}>
                  {t('backToLogin')}
                </Text>
              </Pressable>
            </Link>
          </View>
        )}
      >
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.colors.success + '33',
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.successMuted,
            padding: theme.spacing.lg,
          }}
        >
          <Text style={{ color: theme.colors.success, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
            {t('resetEmailSent')}
          </Text>
        </View>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title={t('forgotPassword')}
      subtitle={t('forgotPasswordSubtitle')}
      footer={(
        <View style={{ alignItems: 'center' }}>
          <Link href="/login" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={t('backToLogin')}>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily, fontSize: 14, lineHeight: 20 }}>
                {t('backToLogin')}
              </Text>
            </Pressable>
          </Link>
        </View>
      )}
    >
      <FormError message={error} />

      <View style={{ gap: theme.spacing.lg }}>
        <Input
          label={t('email')}
          placeholder={t('email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          leftIcon={<Mail size={18} color={theme.colors.mutedForeground} />}
          style={{ fontSize: 15, outlineStyle: 'none' } as any}
        />

        <Button isLoading={isLoading} onPress={handleSubmit}>
          {t('sendResetLink')}
        </Button>
      </View>
    </AuthScaffold>
  );
}
