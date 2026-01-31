import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Lock, Fingerprint, ScanFace } from 'lucide-react-native';
import { useSettings } from '../../context/SettingsContext';
import { useLanguage } from '../../context/LanguageContext';
import { haptics } from '../../utils/haptics';

export function BiometricLock() {
  const { isLocked, unlock, biometricType } = useSettings();
  const { t } = useLanguage();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-authenticate on mount
  useEffect(() => {
    if (isLocked) {
      handleUnlock();
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
      className="absolute inset-0 bg-background z-50 items-center justify-center"
      style={{ elevation: 999 }}
    >
      <View className="items-center px-8">
        {/* Lock Icon */}
        <View className="bg-primary/20 p-6 rounded-full mb-6">
          <Lock size={48} color="rgb(212, 175, 55)" />
        </View>

        {/* Title */}
        <Text className="text-2xl font-bold text-foreground mb-2">
          CoFinance
        </Text>
        <Text className="text-muted-foreground text-center mb-8">
          {t('appLocked') || 'App is locked for your security'}
        </Text>

        {/* Unlock Button */}
        <Pressable
          onPress={handleUnlock}
          disabled={isAuthenticating}
          style={{ cursor: 'pointer' }}
          className={`bg-accent px-8 py-4 rounded-xl flex-row items-center ${
            isAuthenticating ? 'opacity-50' : ''
          }`}
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#09090b" size="small" />
          ) : (
            <>
              <BiometricIcon size={24} color="#09090b" />
              <Text className="text-accent-foreground font-semibold ml-3 text-lg">
                {t('unlockWith') || 'Unlock with'} {biometricType || 'Biometrics'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Error Message */}
        {error && (
          <Text className="text-danger mt-4 text-center">
            {error}
          </Text>
        )}

        {/* Retry hint */}
        {!isAuthenticating && (
          <Text className="text-muted-foreground text-sm mt-6">
            {t('tapToRetry') || 'Tap the button to try again'}
          </Text>
        )}
      </View>
    </View>
  );
}
