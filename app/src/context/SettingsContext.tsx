import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { readJSON, writeJSON } from '../utils/storage';

// Settings keys
const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  // Security
  biometricEnabled: boolean;
  requireBiometricOnOpen: boolean;
  hideBalances: boolean;
  // Notifications
  budgetAlerts: boolean;
  goalReminders: boolean;
  weeklyRecap: boolean;
  // Display
  compactMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  biometricEnabled: false,
  requireBiometricOnOpen: false,
  hideBalances: false,
  budgetAlerts: true,
  goalReminders: true,
  weeklyRecap: true,
  compactMode: false,
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  isLocked: boolean;
  unlock: () => Promise<boolean>;
  lock: () => void;
  biometricType: string | null;
  isBiometricAvailable: boolean;
  toggleHideBalances: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLocked, setIsLocked] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      const saved = await readJSON<AppSettings>(SETTINGS_KEY);
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...saved });
        // Lock app if biometric is enabled
        if (saved.requireBiometricOnOpen) {
          setIsLocked(true);
        }
      }
      setIsLoaded(true);
    }
    loadSettings();
  }, []);

  // Check biometric availability
  useEffect(() => {
    async function checkBiometric() {
      if (Platform.OS === 'web') {
        setIsBiometricAvailable(false);
        return;
      }

      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricAvailable(compatible && enrolled);

        if (compatible && enrolled) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType(Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock');
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType(Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint');
          } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
            setBiometricType('Iris');
          }
        }
      } catch (error) {
        console.error('Error checking biometric:', error);
        setIsBiometricAvailable(false);
      }
    }
    checkBiometric();
  }, []);

  // Lock app when going to background (if enabled)
  useEffect(() => {
    if (!settings.requireBiometricOnOpen) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsLocked(true);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [settings.requireBiometricOnOpen]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await writeJSON(SETTINGS_KEY, newSettings);
  }, [settings]);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      setIsLocked(false);
      return true;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access CoFinance',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }, []);

  const lock = useCallback(() => {
    if (settings.requireBiometricOnOpen) {
      setIsLocked(true);
    }
  }, [settings.requireBiometricOnOpen]);

  const toggleHideBalances = useCallback(async () => {
    const newSettings = { ...settings, hideBalances: !settings.hideBalances };
    setSettings(newSettings);
    await writeJSON(SETTINGS_KEY, newSettings);
  }, [settings]);

  // Don't render children until settings are loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        isLocked,
        unlock,
        lock,
        biometricType,
        isBiometricAvailable,
        toggleHideBalances,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
