import { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { readJSON, writeJSON } from '../utils/storage';
import {
  DEFAULT_REPORT_TIME_ZONE_PREFERENCE,
  type ReportTimeZonePreference,
} from '../utils/reportTimeZone';

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
  reportTimeZonePreference: ReportTimeZonePreference;
}

const DEFAULT_SETTINGS: AppSettings = {
  biometricEnabled: false,
  requireBiometricOnOpen: false,
  hideBalances: false,
  budgetAlerts: true,
  goalReminders: true,
  weeklyRecap: true,
  compactMode: false,
  reportTimeZonePreference: DEFAULT_REPORT_TIME_ZONE_PREFERENCE,
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

  // Keep a ref to settings so the AppState listener always sees current values
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Lock app when going to background (if enabled)
  // Single listener that reads from ref to avoid stale closures
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (settingsRef.current.requireBiometricOnOpen) {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          setIsLocked(true);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const newSettings = { ...prev, ...updates };
      writeJSON(SETTINGS_KEY, newSettings);
      return newSettings;
    });
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      setIsLocked(false);
      return true;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access CoAI',
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
    if (settingsRef.current.requireBiometricOnOpen) {
      setIsLocked(true);
    }
  }, []);

  const toggleHideBalances = useCallback(async () => {
    setSettings((prev) => {
      const newSettings = { ...prev, hideBalances: !prev.hideBalances };
      writeJSON(SETTINGS_KEY, newSettings);
      return newSettings;
    });
  }, []);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      isLocked,
      unlock,
      lock,
      biometricType,
      isBiometricAvailable,
      toggleHideBalances,
    }),
    [settings, updateSettings, isLocked, unlock, lock, biometricType, isBiometricAvailable, toggleHideBalances],
  );

  // Block rendering until settings are loaded from AsyncStorage
  if (!isLoaded) return null;

  return (
    <SettingsContext.Provider value={value}>
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
