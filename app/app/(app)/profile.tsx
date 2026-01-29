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
  History,
  Info,
  Pencil,
  X,
  Check,
  Lock,
  MessageCircle,
  Image,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { api } from '../../src/api';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '' },
  { code: 'fa', name: 'Persian', flag: '' },
  { code: 'ar', name: 'Arabic', flag: '' },
  { code: 'tr', name: 'Turkish', flag: '' },
] as const;

export default function ProfileScreen() {
  const { user, logout, isLoading, refreshProfile } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { t, language, setLanguage } = useLanguage();
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
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
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
    <View className="bg-card rounded-xl overflow-hidden">
      <Text className="text-sm text-muted-foreground p-4 pb-2">{title}</Text>
      {children}
    </View>
  );

  const SettingsItem = ({
    icon,
    label,
    value,
    onPress,
    iconColor = 'rgb(148, 163, 184)',
    showChevron = true,
  }: {
    icon: React.ReactNode;
    label: string;
    value?: string;
    onPress?: () => void;
    iconColor?: string;
    showChevron?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ cursor: onPress ? 'pointer' : undefined } as any}
      className="flex-row items-center justify-between p-4 active:bg-secondary/50"
    >
      <View className="flex-row items-center">
        {icon}
        <Text className="text-foreground ml-3">{label}</Text>
      </View>
      <View className="flex-row items-center">
        {value && <Text className="text-muted-foreground mr-2">{value}</Text>}
        {showChevron && onPress && <ChevronRight size={20} color="rgb(148, 163, 184)" />}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: isDesktop ? 1200 : undefined,
          alignSelf: isDesktop ? 'center' : undefined,
          width: '100%',
        }}
      >
        {/* Header */}
        <View className="flex-row items-center mb-6">
          {!isDesktop && (
            <Pressable
              onPress={() => router.back()}
              style={{ cursor: 'pointer' }}
              className="p-2 mr-2"
            >
              <ChevronLeft size={24} color="rgb(148, 163, 184)" />
            </Pressable>
          )}
          <Text className="text-3xl font-bold text-foreground">{t('profile')}</Text>
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
            <View className="bg-card p-6 rounded-xl mb-6">
              <View className={`${isDesktop ? 'flex-row items-center' : 'items-center'}`}>
                <View className="bg-primary/20 p-4 rounded-full">
                  <User size={48} color="rgb(212, 175, 55)" />
                </View>
                <View className={`${isDesktop ? 'ml-4 flex-1' : 'mt-4 items-center'}`}>
                  <View className="flex-row items-center">
                    <Text className="text-xl font-bold text-foreground">{user?.name}</Text>
                    <Pressable
                      onPress={openEditModal}
                      style={{ cursor: 'pointer' }}
                      className="ml-2 p-1"
                    >
                      <Pencil size={16} color="rgb(148, 163, 184)" />
                    </Pressable>
                  </View>
                  <View className="flex-row items-center mt-2">
                    <Mail size={16} color="rgb(148, 163, 184)" />
                    <Text className="text-muted-foreground ml-2">{user?.email}</Text>
                  </View>
                </View>
              </View>
              {/* Edit Profile Button (mobile) */}
              {!isDesktop && (
                <Pressable
                  onPress={openEditModal}
                  style={{ cursor: 'pointer' }}
                  className="bg-secondary mt-4 p-3 rounded-lg flex-row items-center justify-center"
                >
                  <Pencil size={16} color="rgb(212, 175, 55)" />
                  <Text className="text-foreground font-medium ml-2">{t('editProfile')}</Text>
                </Pressable>
              )}
            </View>

            {/* Appearance Settings */}
            <SettingsSection title={t('appearance')}>
              <SettingsItem
                icon={
                  isDark ? (
                    <Moon size={20} color="rgb(148, 163, 184)" />
                  ) : (
                    <Sun size={20} color="rgb(212, 175, 55)" />
                  )
                }
                label={t('theme')}
                value={isDark ? t('dark') : t('light')}
                onPress={toggleTheme}
                showChevron={false}
              />
            </SettingsSection>

            {/* Language Settings */}
            <View className="mt-4">
              <SettingsSection title={t('language')}>
                {LANGUAGES.map((lang) => (
                  <Pressable
                    key={lang.code}
                    onPress={() => setLanguage(lang.code)}
                    style={{ cursor: 'pointer' }}
                    className="flex-row items-center justify-between p-4 active:bg-secondary/50"
                  >
                    <View className="flex-row items-center">
                      <Text className="text-xl mr-3">{lang.flag}</Text>
                      <Text className="text-foreground">{lang.name}</Text>
                    </View>
                    {language === lang.code && (
                      <View className="w-2 h-2 bg-accent rounded-full" />
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
                icon={<Wallet size={20} color="rgb(212, 175, 55)" />}
                label={t('budgets')}
                onPress={() => router.push('/budgets')}
              />
              <SettingsItem
                icon={<Repeat size={20} color="rgb(212, 175, 55)" />}
                label={t('recurringTransactions')}
                onPress={() => router.push('/recurring')}
              />
              <SettingsItem
                icon={<CreditCard size={20} color="rgb(212, 175, 55)" />}
                label={t('subscriptions')}
                onPress={() => router.push('/subscriptions')}
              />
            </SettingsSection>

            {/* Tools & Features */}
            <View className="mt-4">
              <SettingsSection title={t('toolsAndFeatures') || 'Tools & Features'}>
                <SettingsItem
                  icon={<Trophy size={20} color="rgb(212, 175, 55)" />}
                  label={t('badges') || 'Badges'}
                  onPress={() => router.push('/badges')}
                />
                <SettingsItem
                  icon={<History size={20} color="rgb(212, 175, 55)" />}
                  label={t('historicalRates') || 'Historical Rates'}
                  onPress={() => router.push('/historical')}
                />
                <SettingsItem
                  icon={<Info size={20} color="rgb(148, 163, 184)" />}
                  label={t('aboutUs') || 'About Us'}
                  onPress={() => router.push('/(public)/about')}
                />
              </SettingsSection>
            </View>

            {/* Account Settings */}
            <View className="mt-4">
              <SettingsSection title={t('account')}>
                <SettingsItem
                  icon={<Lock size={20} color="rgb(212, 175, 55)" />}
                  label={t('changePassword')}
                  onPress={() => router.push('/change-password')}
                />
                <SettingsItem
                  icon={<Shield size={20} color="rgb(148, 163, 184)" />}
                  label={t('security')}
                />
                <SettingsItem
                  icon={<Bell size={20} color="rgb(148, 163, 184)" />}
                  label={t('notifications')}
                />
              </SettingsSection>
            </View>

            {/* AI Features */}
            <View className="mt-4">
              <SettingsSection title={t('aiFeatures')}>
                <SettingsItem
                  icon={<MessageCircle size={20} color="rgb(59, 130, 246)" />}
                  label={t('aiAdvisor')}
                  onPress={() => router.push('/(app)/(tabs)/wallet/chat')}
                />
              </SettingsSection>
            </View>

            {/* Logout */}
            <Pressable
              onPress={handleLogout}
              style={{ cursor: 'pointer' }}
              className="bg-danger/10 p-4 rounded-xl flex-row items-center justify-center mt-4"
            >
              <LogOut size={20} color="rgb(220, 38, 38)" />
              <Text className="text-danger font-semibold ml-2">{t('logout')}</Text>
            </Pressable>
          </View>
        </View>

        {/* App Info */}
        <View className="items-center mt-8">
          <Text className="text-muted-foreground">CoFinance v1.0.0</Text>
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
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={() => setShowEditModal(false)}
        >
          <Pressable
            className="bg-card rounded-2xl p-6 m-4"
            style={{ width: isDesktop ? 400 : '90%', maxWidth: 400 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">{t('editProfile')}</Text>
              <Pressable onPress={() => setShowEditModal(false)} style={{ cursor: 'pointer' }}>
                <X size={24} color="rgb(148, 163, 184)" />
              </Pressable>
            </View>

            {/* Name Input */}
            <View className="mb-6">
              <Text className="text-muted-foreground text-sm mb-2">{t('name')}</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder={t('enterName')}
                placeholderTextColor="#71717a"
                autoCapitalize="words"
                selectionColor="rgb(212, 175, 55)"
                cursorColor="rgb(212, 175, 55)"
                style={{
                  backgroundColor: '#27272a',
                  borderWidth: 1,
                  borderColor: '#3f3f46',
                  borderRadius: 8,
                  padding: 14,
                  color: '#ffffff',
                  fontSize: 16,
                  outlineStyle: 'none',
                } as any}
              />
            </View>

            {/* Email Display (read-only) */}
            <View className="mb-6">
              <Text className="text-muted-foreground text-sm mb-2">{t('email')}</Text>
              <View className="bg-muted/50 border border-border p-3.5 rounded-lg">
                <Text className="text-muted-foreground">{user?.email}</Text>
              </View>
              <Text className="text-muted-foreground text-xs mt-1">{t('emailCannotBeChanged') || 'Email cannot be changed'}</Text>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowEditModal(false)}
                disabled={updateProfileMutation.isPending}
                style={{ cursor: 'pointer' }}
                className={`flex-1 p-3 rounded-lg border border-border items-center ${
                  updateProfileMutation.isPending ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-foreground font-medium">{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                style={{ cursor: 'pointer' }}
                className={`flex-1 bg-accent p-3 rounded-lg flex-row items-center justify-center ${
                  updateProfileMutation.isPending ? 'opacity-50' : ''
                }`}
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator color="#09090b" size="small" />
                ) : (
                  <>
                    <Check size={18} color="#09090b" />
                    <Text className="text-accent-foreground font-medium ml-2">
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
