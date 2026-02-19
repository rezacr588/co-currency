import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import {
  User,
  Mail,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Shield,
  Bell,
  Wallet,
  CreditCard,
  Repeat,
  Trophy,
  Target,
  History,
  Info,
  Pencil,
  X,
  Check,
  Lock,
  MessageCircle,
  Image,
  StickyNote,
  Fingerprint,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useTheme as useStyledTheme } from 'styled-components/native';
import { useLanguage } from '../../src/context/LanguageContext';
import { useSettings } from '../../src/context/SettingsContext';
import { api } from '../../src/api';
import { haptics } from '../../src/utils/haptics';
import { Toggle } from '../../src/components/ui/Toggle';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fa', name: 'Persian', flag: '🇮🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
] as const;

export default function ProfileScreen() {
  const { user, logout, isLoading, refreshProfile } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const { t, language, setLanguage } = useLanguage();
  const { settings, updateSettings, isBiometricAvailable, biometricType } = useSettings();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  // Edit profile state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');

  const handleLogout = async () => {
    await logout();
  };

  const openEditModal = useCallback(() => {
    setEditName(user?.name || '');
    setShowEditModal(true);
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: { name: string }) => api.auth.updateProfile(data),
    onSuccess: async () => {
      await refreshProfile();
      setShowEditModal(false);
      Alert.alert(t('profileUpdated'));
    },
    onError: (err) => {
      Alert.alert(t('updateFailed'), err instanceof Error ? err.message : t('updateFailed'));
    },
  });

  const handleSaveProfile = useCallback(() => {
    if (!editName.trim()) {
      Alert.alert(t('enterName'));
      return;
    }

    if (editName === user?.name) {
      Alert.alert(t('noChanges'));
      return;
    }

    updateProfileMutation.mutate({ name: editName.trim() });
  }, [editName, user, updateProfileMutation, t]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const SettingsSection = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={{ backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' }}>
      <Text style={{ fontSize: 14, color: colors.mutedForeground, padding: 16, paddingBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );

  const SettingsItem = ({
    icon,
    label,
    value,
    onPress,
    iconColor,
    showChevron = true,
    isLast = false,
  }: {
    icon: React.ReactNode;
    label: string;
    value?: string;
    onPress?: () => void;
    iconColor?: string;
    showChevron?: boolean;
    isLast?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [{ cursor: onPress ? 'pointer' : undefined, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: !isLast ? 1 : 0, borderBottomColor: colors.border }, pressed && onPress && { opacity: 0.7 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {icon}
        <Text style={{ color: colors.foreground, marginLeft: 12 }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {value && <Text style={{ color: colors.mutedForeground, marginRight: 8 }}>{value}</Text>}
        {showChevron && onPress && <ChevronRight size={20} color={colors.placeholder} />}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: isDesktop ? 1200 : undefined,
          alignSelf: isDesktop ? 'center' : undefined,
          width: '100%',
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          {!isDesktop && (
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={{ cursor: 'pointer', padding: 8, marginRight: 8 }}
            >
              <ChevronLeft size={24} color={colors.placeholder} />
            </Pressable>
          )}
          <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('profile')}</Text>
        </View>

        {/* Desktop: Two column layout, Mobile: Single column */}
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            gap: 24,
          }}
        >
          {/* Left Column - User Info & Appearance */}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            {/* User Info Card */}
            <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
              <View style={{ flexDirection: isDesktop ? 'row' : 'column', alignItems: 'center' }}>
                <View style={{ backgroundColor: colors.primary + '33', padding: 16, borderRadius: 9999 }}>
                  <User size={48} color={colors.accent} />
                </View>
                <View style={{ marginLeft: isDesktop ? 16 : 0, flex: isDesktop ? 1 : undefined, marginTop: isDesktop ? 0 : 16, alignItems: isDesktop ? undefined : 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{user?.name}</Text>
                    <Pressable
                      onPress={openEditModal}
                      hitSlop={12}
                      style={{ cursor: 'pointer', marginLeft: 8, padding: 4 }}
                    >
                      <Pencil size={16} color={colors.placeholder} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Mail size={16} color={colors.placeholder} />
                    <Text style={{ color: colors.mutedForeground, marginLeft: 8 }}>{user?.email}</Text>
                  </View>
                </View>
              </View>
              {/* Edit Profile Button (mobile) */}
              {!isDesktop && (
                <Pressable
                  onPress={openEditModal}
                  style={{ cursor: 'pointer', backgroundColor: colors.secondary, marginTop: 16, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Pencil size={16} color={colors.accent} />
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', marginLeft: 8 }}>{t('editProfile')}</Text>
                </Pressable>
              )}
            </View>

            {/* Appearance Settings */}
            <SettingsSection title={t('appearance')}>
              <SettingsItem
                icon={
                  isDark ? (
                    <Moon size={20} color={colors.placeholder} />
                  ) : (
                    <Sun size={20} color={colors.accent} />
                  )
                }
                label={t('theme')}
                value={isDark ? t('dark') : t('light')}
                onPress={toggleTheme}
                showChevron={false}
                isLast
              />
            </SettingsSection>

            {/* Language Settings */}
            <View style={{ marginTop: 16 }}>
              <SettingsSection title={t('language')}>
                {LANGUAGES.map((lang) => (
                  <Pressable
                    key={lang.code}
                    onPress={() => setLanguage(lang.code)}
                    style={({ pressed }) => [{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }, pressed && { opacity: 0.7 }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 20, marginRight: 12 }}>{lang.flag}</Text>
                      <Text style={{ color: colors.foreground }}>{lang.name}</Text>
                    </View>
                    {language === lang.code && (
                      <View style={{ width: 8, height: 8, backgroundColor: colors.accent, borderRadius: 9999 }} />
                    )}
                  </Pressable>
                ))}
              </SettingsSection>
            </View>
          </View>

          {/* Right Column - Finance & Account */}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            {/* Finance Management */}
            <SettingsSection title={t('financeManagement')}>
              <SettingsItem
                icon={<Wallet size={20} color={colors.accent} />}
                label={t('budgets')}
                onPress={() => router.push('/budgets')}
              />
              <SettingsItem
                icon={<Repeat size={20} color={colors.accent} />}
                label={t('recurringTransactions')}
                onPress={() => router.push('/recurring')}
              />
              <SettingsItem
                icon={<CreditCard size={20} color={colors.accent} />}
                label={t('subscriptions')}
                onPress={() => router.push('/subscriptions')}
                isLast
              />
            </SettingsSection>

            {/* Tools & Features */}
            <View style={{ marginTop: 16 }}>
              <SettingsSection title={t('toolsAndFeatures') || 'Tools & Features'}>
                <SettingsItem
                  icon={<StickyNote size={20} color={colors.accent} />}
                  label={t('notes') || 'Notes'}
                  onPress={() => router.push('/notes')}
                />
                <SettingsItem
                  icon={<Trophy size={20} color={colors.accent} />}
                  label={t('badges') || 'Badges'}
                  onPress={() => router.push('/badges')}
                />
                <SettingsItem
                  icon={<Target size={20} color={colors.accent} />}
                  label={t('challenges') || 'Challenges'}
                  onPress={() => router.push('/challenges')}
                />
                <SettingsItem
                  icon={<History size={20} color={colors.accent} />}
                  label={t('historicalRates') || 'Historical Rates'}
                  onPress={() => router.push('/historical')}
                />
                <SettingsItem
                  icon={<Info size={20} color={colors.placeholder} />}
                  label={t('aboutUs') || 'About Us'}
                  onPress={() => router.push('/(public)/about')}
                  isLast
                />
              </SettingsSection>
            </View>

            {/* Security & Privacy */}
            <View style={{ marginTop: 16 }}>
              <SettingsSection title={t('securityAndPrivacy') || 'Security & Privacy'}>
                {/* Biometric Lock */}
                {isBiometricAvailable && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
                      <Fingerprint size={20} color={colors.accent} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ color: colors.foreground }}>{biometricType || t('biometricLock') || 'Biometric Lock'}</Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                          {t('requireAuthOnOpen') || 'Require authentication when opening app'}
                        </Text>
                      </View>
                    </View>
                    <Toggle
                      value={settings.requireBiometricOnOpen}
                      onValueChange={(val) => updateSettings({ requireBiometricOnOpen: val })}
                    />
                  </View>
                )}

                {/* Hide Balances */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
                    {settings.hideBalances ? (
                      <EyeOff size={20} color={colors.accent} />
                    ) : (
                      <Eye size={20} color={colors.accent} />
                    )}
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: colors.foreground }}>{t('hideBalances') || 'Hide Balances'}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                        {t('hideBalancesDesc') || 'Hide amounts on dashboard for privacy'}
                      </Text>
                    </View>
                  </View>
                  <Toggle
                    value={settings.hideBalances}
                    onValueChange={(val) => updateSettings({ hideBalances: val })}
                  />
                </View>

                {/* Change Password */}
                <SettingsItem
                  icon={<Lock size={20} color={colors.accent} />}
                  label={t('changePassword')}
                  onPress={() => router.push('/change-password')}
                  isLast
                />
              </SettingsSection>
            </View>

            {/* Account Settings */}
            <View style={{ marginTop: 16 }}>
              <SettingsSection title={t('account')}>
                <SettingsItem
                  icon={<Bell size={20} color={colors.accent} />}
                  label={t('notifications')}
                  onPress={() => router.push('/notification-settings')}
                  isLast
                />
              </SettingsSection>
            </View>

            {/* AI Features */}
            <View style={{ marginTop: 16 }}>
              <SettingsSection title={t('aiFeatures')}>
                <SettingsItem
                  icon={<MessageCircle size={20} color={colors.info} />}
                  label={t('aiAdvisor')}
                  onPress={() => router.push('/(app)/(tabs)/wallet/chat')}
                  isLast
                />
              </SettingsSection>
            </View>

            {/* Logout */}
            <Pressable
              onPress={handleLogout}
              style={{ cursor: 'pointer', backgroundColor: colors.danger + '1a', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}
            >
              <LogOut size={20} color={colors.danger} />
              <Text style={{ color: colors.danger, fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>{t('logout')}</Text>
            </Pressable>
          </View>
        </View>

        {/* App Info */}
        <View style={{ alignItems: 'center', marginTop: 32 }}>
          <Text style={{ color: colors.mutedForeground }}>CoFinance v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowEditModal(false)}
        >
          <Pressable
            style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, margin: 16, width: isDesktop ? 400 : '90%', maxWidth: 400 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('editProfile')}</Text>
              <Pressable onPress={() => setShowEditModal(false)} hitSlop={8} style={{ cursor: 'pointer', padding: 8 }}>
                <X size={24} color={colors.placeholder} />
              </Pressable>
            </View>

            {/* Name Input */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('name')}</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder={t('enterName')}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                style={{
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  borderRadius: 8,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 16,
                  outlineStyle: 'none',
                } as any}
              />
            </View>

            {/* Email Display (read-only) */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('email')}</Text>
              <View style={{ backgroundColor: colors.muted + '80', borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8 }}>
                <Text style={{ color: colors.mutedForeground }}>{user?.email}</Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>{t('emailCannotBeChanged') || 'Email cannot be changed'}</Text>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowEditModal(false)}
                disabled={updateProfileMutation.isPending}
                style={{ cursor: 'pointer', flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', opacity: updateProfileMutation.isPending ? 0.5 : 1 }}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                style={{ cursor: 'pointer', flex: 1, backgroundColor: colors.accent, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: updateProfileMutation.isPending ? 0.5 : 1 }}
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <>
                    <Check size={18} color={colors.primaryForeground} />
                    <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium', marginLeft: 8 }}>
                      {t('saveChanges')}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
