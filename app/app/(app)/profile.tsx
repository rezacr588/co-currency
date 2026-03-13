import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import {
  User,
  Mail,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
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
  StickyNote,
  Fingerprint,
  Eye,
  EyeOff,
  Clock3,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useTheme as useStyledTheme } from 'styled-components/native';
import { useLanguage } from '../../src/context/LanguageContext';
import { useSettings } from '../../src/context/SettingsContext';
import { api } from '../../src/api';
import { AppSwitcherTrigger } from '../../src/components/navigation/AppSwitcherTrigger';
import { PageHeader, PageScaffold } from '../../src/components/ui';
import { Toggle } from '../../src/components/ui/Toggle';
import { getDeviceTimeZone, type ReportTimeZonePreference } from '../../src/utils/reportTimeZone';

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
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const strongBorder = colors.borderStrong || colors.border;
  const sectionGap = isDesktop ? 20 : 16;

  // Edit profile state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReportTimeZoneModal, setShowReportTimeZoneModal] = useState(false);
  const [editName, setEditName] = useState('');
  const deviceTimeZone = getDeviceTimeZone();
  const reportTimeZoneLabel =
    settings.reportTimeZonePreference === 'device'
      ? t('analyticsTimeZoneDevice')
      : settings.reportTimeZonePreference === 'utc'
        ? t('analyticsTimeZoneUtc')
        : t('analyticsTimeZoneTurkish');
  const reportTimeZoneOptions: {
    preference: ReportTimeZonePreference;
    label: string;
    description: string;
  }[] = [
    {
      preference: 'turkish',
      label: t('analyticsTimeZoneTurkish'),
      description: t('analyticsTimeZoneTurkishDesc'),
    },
    {
      preference: 'device',
      label: t('analyticsTimeZoneDevice'),
      description: `${t('analyticsTimeZoneDeviceDesc')} (${deviceTimeZone})`,
    },
    {
      preference: 'utc',
      label: t('analyticsTimeZoneUtc'),
      description: t('analyticsTimeZoneUtcDesc'),
    },
  ];

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
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: isDesktop ? 18 : 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDesktop ? strongBorder + '80' : colors.border,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDesktop ? 0.08 : 0,
        shadowRadius: isDesktop ? 18 : 0,
        elevation: isDesktop ? 2 : 0,
      }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
        <Text
          style={{
            fontSize: isDesktop ? 11 : 13,
            color: colors.mutedForeground,
            fontFamily: 'Inter_600SemiBold',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Text>
      </View>
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
      style={({ pressed }) => [{
        cursor: onPress ? 'pointer' : undefined,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: isDesktop ? 14 : 16,
        minHeight: 56,
        borderBottomWidth: !isLast ? 1 : 0,
        borderBottomColor: colors.border,
        opacity: pressed && onPress ? 0.72 : 1,
      }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: (iconColor || colors.accent) + '1A',
            borderWidth: 1,
            borderColor: (iconColor || colors.accent) + '33',
          }}
        >
          {icon}
        </View>
        <Text
          style={{
            color: colors.foreground,
            marginStart: 12,
            fontFamily: isDesktop ? 'Inter_500Medium' : undefined,
            flexShrink: 1,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginStart: 12 }}>
        {value && (
          <View
            style={{
              marginEnd: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.muted,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{value}</Text>
          </View>
        )}
        {showChevron && onPress && <ChevronRight size={20} color={colors.placeholder} />}
      </View>
    </Pressable>
  );

  return (
    <>
      <PageScaffold
        scroll
        maxWidth={1120}
        contentContainerStyle={{
          paddingBottom: isDesktop ? 40 : Math.max(insets.bottom, 16) + 24,
        }}
      >
        <PageHeader
          title={t('profile')}
          subtitle={t('profileSubtitle') || 'Manage your account details and security'}
          backHref={!isDesktop ? ('/(app)/(tabs)' as any) : undefined}
          actions={!isDesktop ? <AppSwitcherTrigger variant="header_inline" /> : undefined}
        />

        {isDesktop ? (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: strongBorder + '80',
              padding: 20,
              marginBottom: 20,
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    backgroundColor: colors.primary + '18',
                    borderWidth: 1,
                    borderColor: colors.primary + '33',
                    padding: 14,
                    borderRadius: 9999,
                  }}
                >
                  <User size={34} color={colors.primary} />
                </View>
                <View style={{ marginStart: 14 }}>
                  <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{user?.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Mail size={14} color={colors.placeholder} />
                    <Text style={{ color: colors.mutedForeground, marginStart: 6 }}>{user?.email}</Text>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={openEditModal}
                style={({ pressed }) => [{
                  backgroundColor: colors.primary,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  opacity: pressed ? 0.82 : 1,
                }]}
              >
                <Pencil size={15} color={colors.primaryForeground} />
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', marginStart: 8 }}>
                  {t('editProfile')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Desktop: Two column layout, Mobile: Single column */}
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            gap: isDesktop ? 20 : sectionGap,
            alignItems: 'flex-start',
          }}
        >
          {/* Left Column - User Info & Appearance */}
          <View style={{ width: isDesktop ? 360 : '100%', gap: isDesktop ? 0 : sectionGap }}>
            {!isDesktop && (
              <View style={{ backgroundColor: colors.card, padding: 20, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: sectionGap }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: colors.accent + '1A', borderWidth: 1, borderColor: colors.accent + '33', padding: 14, borderRadius: 9999 }}>
                    <User size={32} color={colors.accent} />
                  </View>
                  <View style={{ marginStart: 14, flex: 1 }}>
                    <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground }} numberOfLines={1}>{user?.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Mail size={14} color={colors.placeholder} />
                      <Text style={{ color: colors.mutedForeground, marginStart: 6, fontSize: 14 }} numberOfLines={1}>{user?.email}</Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={openEditModal}
                  style={({ pressed }) => [{
                    cursor: 'pointer',
                    backgroundColor: colors.accent + '14',
                    borderWidth: 1,
                    borderColor: colors.accent + '33',
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.72 : 1,
                  }]}
                >
                  <Pencil size={16} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontFamily: 'Inter_600SemiBold', marginStart: 8 }}>{t('editProfile')}</Text>
                </Pressable>
              </View>
            )}

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
              />
              <SettingsItem
                icon={<Clock3 size={20} color={colors.accent} />}
                label={t('analyticsTimeZone')}
                value={reportTimeZoneLabel}
                onPress={() => setShowReportTimeZoneModal(true)}
                isLast
              />
            </SettingsSection>

            {/* Language Settings */}
            <View style={{ marginTop: isDesktop ? 16 : 0 }}>
              <SettingsSection title={t('language')}>
                {LANGUAGES.map((lang) => (
                  <Pressable
                    key={lang.code}
                    onPress={() => setLanguage(lang.code)}
                    style={({ pressed }) => [{
                      cursor: 'pointer',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderBottomWidth: lang.code === LANGUAGES[LANGUAGES.length - 1].code ? 0 : 1,
                      borderBottomColor: colors.border,
                      opacity: pressed ? 0.72 : 1,
                      backgroundColor: language === lang.code ? colors.accent + '14' : 'transparent',
                    }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 20, marginEnd: 12 }}>{lang.flag}</Text>
                      <Text style={{ color: colors.foreground, fontFamily: language === lang.code ? 'Inter_500Medium' : undefined }}>
                        {lang.name}
                      </Text>
                    </View>
                    {language === lang.code && (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 9999,
                          borderWidth: 1,
                          borderColor: colors.accent + '66',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.accent + '22',
                        }}
                      >
                        <View style={{ width: 8, height: 8, backgroundColor: colors.accent, borderRadius: 9999 }} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </SettingsSection>
            </View>

            {isDesktop && (
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [{
                  cursor: 'pointer',
                  backgroundColor: colors.danger + '14',
                  borderWidth: 1,
                  borderColor: colors.danger + '40',
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 16,
                  opacity: pressed ? 0.72 : 1,
                }]}
              >
                <LogOut size={20} color={colors.danger} />
                <Text style={{ color: colors.danger, fontFamily: 'Inter_600SemiBold', marginStart: 8 }}>{t('logout')}</Text>
              </Pressable>
            )}
          </View>

          {/* Right Column - Finance & Account */}
          <View style={{ flex: 1, minWidth: 0, width: isDesktop ? undefined : '100%' }}>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: sectionGap }}>
              <View style={{ flex: 1 }}>
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
              </View>

              <View style={{ flex: 1 }}>
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
            </View>

            {/* Security & Privacy */}
            <View style={{ marginTop: sectionGap }}>
              <SettingsSection title={t('securityAndPrivacy') || 'Security & Privacy'}>
                {isBiometricAvailable && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginEnd: 16 }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.accent + '1A',
                          borderWidth: 1,
                          borderColor: colors.accent + '33',
                        }}
                      >
                        <Fingerprint size={20} color={colors.accent} />
                      </View>
                      <View style={{ marginStart: 12, flex: 1 }}>
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

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginEnd: 16 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.accent + '1A',
                        borderWidth: 1,
                        borderColor: colors.accent + '33',
                      }}
                    >
                      {settings.hideBalances ? (
                        <EyeOff size={20} color={colors.accent} />
                      ) : (
                        <Eye size={20} color={colors.accent} />
                      )}
                    </View>
                    <View style={{ marginStart: 12, flex: 1 }}>
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

                <SettingsItem
                  icon={<Lock size={20} color={colors.accent} />}
                  label={t('changePassword')}
                  onPress={() => router.push('/change-password')}
                  isLast
                />
              </SettingsSection>
            </View>

            <View style={{ marginTop: sectionGap, flexDirection: isDesktop ? 'row' : 'column', gap: sectionGap }}>
              <View style={{ flex: isDesktop ? 1 : undefined }}>
                <SettingsSection title={t('account')}>
                  <SettingsItem
                    icon={<Bell size={20} color={colors.accent} />}
                    label={t('notifications')}
                    onPress={() => router.push('/notification-settings')}
                    isLast
                  />
                </SettingsSection>
              </View>
              <View style={{ flex: isDesktop ? 1 : undefined }}>
                <SettingsSection title={t('aiFeatures')}>
                  <SettingsItem
                    icon={<MessageCircle size={20} color={colors.info} />}
                    label={t('aiAdvisor')}
                    onPress={() => router.push('/(app)/(tabs)/wallet/chat')}
                    isLast
                  />
                </SettingsSection>
              </View>
            </View>

            {!isDesktop && (
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [{
                  cursor: 'pointer',
                  backgroundColor: colors.danger + '14',
                  borderWidth: 1,
                  borderColor: colors.danger + '40',
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: sectionGap,
                  opacity: pressed ? 0.72 : 1,
                }]}
              >
                <LogOut size={20} color={colors.danger} />
                <Text style={{ color: colors.danger, fontFamily: 'Inter_600SemiBold', marginStart: 8 }}>{t('logout')}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* App Info */}
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>CoAI v1.0.0</Text>
        </View>
      </PageScaffold>

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
                    <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium', marginStart: 8 }}>
                      {t('saveChanges')}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showReportTimeZoneModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowReportTimeZoneModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowReportTimeZoneModal(false)}
        >
          <Pressable
            style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, margin: 16, width: isDesktop ? 420 : '90%', maxWidth: 420 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                {t('analyticsTimeZone')}
              </Text>
              <Pressable onPress={() => setShowReportTimeZoneModal(false)} hitSlop={8} style={{ cursor: 'pointer', padding: 8 }}>
                <X size={24} color={colors.placeholder} />
              </Pressable>
            </View>

            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 16 }}>
              {t('analyticsTimeZoneDesc')}
            </Text>

            <View style={{ gap: 10 }}>
              {reportTimeZoneOptions.map((option) => {
                const isSelected = settings.reportTimeZonePreference === option.preference;
                return (
                  <Pressable
                    key={option.preference}
                    onPress={async () => {
                      await updateSettings({ reportTimeZonePreference: option.preference });
                      setShowReportTimeZoneModal(false);
                    }}
                    style={({ pressed }) => [{
                      cursor: 'pointer',
                      borderWidth: 1,
                      borderColor: isSelected ? colors.accent : colors.border,
                      backgroundColor: isSelected ? colors.accent + '12' : colors.secondary + '33',
                      borderRadius: 12,
                      padding: 14,
                      opacity: pressed ? 0.72 : 1,
                    }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, paddingEnd: 12 }}>
                        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                          {option.label}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                          {option.description}
                        </Text>
                      </View>
                      {isSelected ? <Check size={18} color={colors.accent} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
