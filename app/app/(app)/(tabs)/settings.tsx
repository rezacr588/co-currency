import { memo } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Bell,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  BarChart3,
  Target,
  Repeat,
  Trophy,
  CreditCard,
  StickyNote,
  MessageCircle,
  Clock3,
  History,
  Info,
  Lock,
  Fingerprint,
  Globe,
} from 'lucide-react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useTheme as useStyledTheme } from 'styled-components/native';
import { useLanguage } from '@/src/context/LanguageContext';
import { useSettings } from '@/src/context/SettingsContext';
import { AppSwitcherTrigger } from '@/src/components/navigation/AppSwitcherTrigger';
import { PageHeader, PageScaffold } from '@/src/components/ui';
import { Toggle } from '@/src/components/ui/Toggle';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  showChevron?: boolean;
  accessoryRight?: React.ReactNode;
}

function MenuItem({ icon, label, onPress, showChevron = true, accessoryRight }: MenuItemProps) {
  const theme = useStyledTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.md,
          marginBottom: 8,
        },
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={{ marginRight: 12 }}>{icon}</View>
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          color: theme.colors.foreground,
          fontFamily: theme.typography.body.fontFamily,
        }}
      >
        {label}
      </Text>
      {accessoryRight || (showChevron && <ChevronRight size={20} color={theme.colors.mutedForeground} />)}
    </Pressable>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const theme = useStyledTheme();

  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: theme.colors.mutedForeground,
          fontFamily: theme.typography.label.fontFamily,
          marginBottom: 12,
          paddingHorizontal: 4,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

export default memo(function SettingsScreen() {
  const router = useRouter();
  const theme = useStyledTheme();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWideScreen = width > 768;

  const handleLogout = () => {
    logout();
  };

  return (
    <PageScaffold>
      <PageHeader
        title={t('settings') || 'Settings'}
        actions={<AppSwitcherTrigger variant="header_inline" />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: isWideScreen ? 24 : 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <Section title={t('account') || 'Account'}>
          <Pressable
            onPress={() => router.push('/(app)/profile')}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                backgroundColor: theme.colors.card,
                borderRadius: theme.radii.lg,
                marginBottom: 8,
              },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('profile') || 'Profile'}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: theme.radii.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary,
                marginRight: 16,
              }}
            >
              <User size={28} color={theme.colors.primaryForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 17,
                  color: theme.colors.foreground,
                  fontFamily: theme.typography.bodyMedium.fontFamily,
                  marginBottom: 4,
                }}
              >
                {user?.name || t('user') || 'User'}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.mutedForeground,
                }}
              >
                {user?.email}
              </Text>
            </View>
            <ChevronRight size={20} color={theme.colors.mutedForeground} />
          </Pressable>

          <MenuItem
            icon={<Lock size={20} color={theme.colors.foreground} />}
            label={t('changePassword') || 'Change Password'}
            onPress={() => router.push('/(app)/change-password')}
          />

          <MenuItem
            icon={<Bell size={20} color={theme.colors.foreground} />}
            label={t('notificationSettings') || 'Notifications'}
            onPress={() => router.push('/(app)/notification-settings')}
          />
        </Section>

        {/* Finance Features */}
        <Section title={t('finance') || 'Finance'}>
          <MenuItem
            icon={<BarChart3 size={20} color={theme.colors.foreground} />}
            label={t('reports') || 'Reports & Analytics'}
            onPress={() => router.push('/(app)/(tabs)/reports')}
          />

          <MenuItem
            icon={<Target size={20} color={theme.colors.foreground} />}
            label={t('financialGoals') || 'Financial Goals'}
            onPress={() => router.push('/(app)/(tabs)/goals')}
          />

          <MenuItem
            icon={<Repeat size={20} color={theme.colors.foreground} />}
            label={t('recurringTransactions') || 'Recurring Transactions'}
            onPress={() => router.push('/(app)/recurring')}
          />

          <MenuItem
            icon={<CreditCard size={20} color={theme.colors.foreground} />}
            label={t('budgets') || 'Budgets'}
            onPress={() => router.push('/(app)/budgets')}
          />

          <MenuItem
            icon={<Clock3 size={20} color={theme.colors.foreground} />}
            label={t('subscriptions') || 'Subscriptions'}
            onPress={() => router.push('/(app)/subscriptions')}
          />

          <MenuItem
            icon={<StickyNote size={20} color={theme.colors.foreground} />}
            label={t('notes') || 'Notes'}
            onPress={() => router.push('/(app)/notes')}
          />
        </Section>

        {/* Gamification */}
        <Section title={t('achievements') || 'Achievements'}>
          <MenuItem
            icon={<Trophy size={20} color={theme.colors.foreground} />}
            label={t('badges') || 'Badges & Challenges'}
            onPress={() => router.push('/(app)/badges')}
          />
        </Section>

        {/* App Settings */}
        <Section title={t('appSettings') || 'App Settings'}>
          <MenuItem
            icon={isDark ? <Moon size={20} color={theme.colors.foreground} /> : <Sun size={20} color={theme.colors.foreground} />}
            label={t('darkMode') || 'Dark Mode'}
            onPress={toggleTheme}
            showChevron={false}
            accessoryRight={<Toggle value={isDark} onValueChange={toggleTheme} />}
          />

          <MenuItem
            icon={<Fingerprint size={20} color={theme.colors.foreground} />}
            label={t('biometricAuth') || 'Biometric Authentication'}
            onPress={() => router.push('/(app)/profile')}
            showChevron={false}
            accessoryRight={<Toggle value={settings.biometricEnabled} onValueChange={() => {}} disabled />}
          />

          <MenuItem
            icon={<Globe size={20} color={theme.colors.foreground} />}
            label={t('language') || 'Language'}
            onPress={() => router.push('/(app)/profile')}
          />
        </Section>

        {/* About */}
        <Section title={t('about') || 'About'}>
          <MenuItem
            icon={<History size={20} color={theme.colors.foreground} />}
            label={t('historical') || 'Historical Data'}
            onPress={() => router.push('/(app)/historical')}
          />

          <MenuItem
            icon={<Info size={20} color={theme.colors.foreground} />}
            label={t('about') || 'About CoAI'}
            onPress={() => router.push('/(public)/about')}
          />
        </Section>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radii.md,
              marginTop: 8,
              marginBottom: 24,
            },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('logout') || 'Logout'}
        >
          <LogOut size={20} color={theme.colors.danger} />
          <Text
            style={{
              marginLeft: 12,
              fontSize: 16,
              color: theme.colors.danger,
              fontFamily: theme.typography.bodyMedium.fontFamily,
            }}
          >
            {t('logout') || 'Logout'}
          </Text>
        </Pressable>
      </ScrollView>
    </PageScaffold>
  );
});
