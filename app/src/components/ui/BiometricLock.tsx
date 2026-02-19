import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Lock, Fingerprint, ScanFace } from 'lucide-react-native';
import { useSettings } from '../../context/SettingsContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../utils/haptics';

export function BiometricLock() {
  const { isLocked, unlock, biometricType } = useSettings();
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttempted = useRef(false);

  // Auto-authenticate on mount
  useEffect(() => {
    if (isLocked && !hasAttempted.current) {
      hasAttempted.current = true;
      handleUnlock();
    }
    if (!isLocked) {
      hasAttempted.current = false;
    }
  }, [isLocked]);

  const handleUnlock = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    setError(null);

    const success = await unlock();

    if (success) {
      haptics.success();
    } else {
      haptics.error();
      setError(t('authenticationFailed') || 'Authentication failed. Try again.');
    }

    setIsAuthenticating(false);
  };

  if (!isLocked) return null;

  const BiometricIcon = biometricType?.includes('Face') ? ScanFace : Fingerprint;

  return (
    <View
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, alignItems: 'center', justifyContent: 'center', elevation: 999, backgroundColor: colors.background }}
    >
      <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
        {/* Lock Icon */}
        <View style={{ backgroundColor: colors.accentMuted + '33', padding: 24, borderRadius: 9999, marginBottom: 24 }}>
          <Lock size={48} color={colors.accent} />
        </View>

        {/* Title */}
        <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 8, color: colors.foreground }}>
          CoFinance
        </Text>
        <Text style={{ textAlign: 'center', marginBottom: 32, color: colors.mutedForeground }}>
          {t('appLocked') || 'App is locked for your security'}
        </Text>

        {/* Unlock Button */}
        <Pressable
          onPress={handleUnlock}
          disabled={isAuthenticating}
          style={{
            cursor: 'pointer',
            backgroundColor: colors.accent,
            paddingHorizontal: 32,
            paddingVertical: 16,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: isAuthenticating ? 0.5 : 1,
          }}
        >
          {isAuthenticating ? (
            <ActivityIndicator color={colors.accentForeground} size="small" />
          ) : (
            <>
              <BiometricIcon size={24} color={colors.accentForeground} />
              <Text style={{ fontFamily: 'Inter_600SemiBold', marginLeft: 12, fontSize: 18, color: colors.accentForeground }}>
                {t('unlockWith') || 'Unlock with'} {biometricType || 'Biometrics'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Error Message */}
        {error && (
          <Text style={{ marginTop: 16, textAlign: 'center', color: colors.danger }}>
            {error}
          </Text>
        )}

        {/* Retry hint */}
        {!isAuthenticating && (
          <Text style={{ fontSize: 14, marginTop: 24, color: colors.mutedForeground }}>
            {t('tapToRetry') || 'Tap the button to try again'}
          </Text>
        )}
      </View>
    </View>
  );
}
