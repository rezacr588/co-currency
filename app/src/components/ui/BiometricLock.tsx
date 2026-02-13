import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Lock, Fingerprint, ScanFace } from 'lucide-react-native';
import { useSettings } from '../../context/SettingsContext';
import { useLanguage } from '../../context/LanguageContext';
import { useColors } from '../../context/ThemeContext';
import { haptics } from '../../utils/haptics';

export function BiometricLock() {
  const { isLocked, unlock, biometricType } = useSettings();
  const { t } = useLanguage();
  const colors = useColors();
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
      className="absolute inset-0 z-50 items-center justify-center"
      style={{ elevation: 999, backgroundColor: colors.background }}
    >
      <View className="items-center px-8">
        {/* Lock Icon */}
        <View style={{ backgroundColor: colors.accentMuted + '33' }} className="p-6 rounded-full mb-6">
          <Lock size={48} color={colors.accent} />
        </View>

        {/* Title */}
        <Text className="text-2xl font-bold mb-2" style={{ color: colors.foreground }}>
          CoFinance
        </Text>
        <Text className="text-center mb-8" style={{ color: colors.mutedForeground }}>
          {t('appLocked') || 'App is locked for your security'}
        </Text>

        {/* Unlock Button */}
        <Pressable
          onPress={handleUnlock}
          disabled={isAuthenticating}
          style={{ cursor: 'pointer', backgroundColor: colors.accent }}
          className={`px-8 py-4 rounded-xl flex-row items-center ${
            isAuthenticating ? 'opacity-50' : ''
          }`}
        >
          {isAuthenticating ? (
            <ActivityIndicator color={colors.accentForeground} size="small" />
          ) : (
            <>
              <BiometricIcon size={24} color={colors.accentForeground} />
              <Text className="font-semibold ml-3 text-lg" style={{ color: colors.accentForeground }}>
                {t('unlockWith') || 'Unlock with'} {biometricType || 'Biometrics'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Error Message */}
        {error && (
          <Text className="mt-4 text-center" style={{ color: colors.danger }}>
            {error}
          </Text>
        )}

        {/* Retry hint */}
        {!isAuthenticating && (
          <Text className="text-sm mt-6" style={{ color: colors.mutedForeground }}>
            {t('tapToRetry') || 'Tap the button to try again'}
          </Text>
        )}
      </View>
    </View>
  );
}
