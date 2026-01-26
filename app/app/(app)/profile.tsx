import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  Globe,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  Shield,
  Bell,
  Wallet,
  Target,
  CreditCard,
  Repeat,
  CalendarClock,
  Trophy,
  History,
  Info,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fa', name: 'فارسی', flag: '🇮🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
] as const;

export default function ProfileScreen() {
  const { user, logout, isLoading } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="p-6">
        <Text className="text-3xl font-bold text-foreground mb-6">{t('profile')}</Text>

        {/* User Info Card */}
        <View className="bg-card p-6 rounded-xl mb-6 items-center">
          <View className="bg-primary/20 p-4 rounded-full mb-4">
            <User size={48} color="rgb(212, 175, 55)" />
          </View>
          <Text className="text-xl font-bold text-foreground">{user?.name}</Text>
          <View className="flex-row items-center mt-2">
            <Mail size={16} color="rgb(148, 163, 184)" />
            <Text className="text-muted-foreground ml-2">{user?.email}</Text>
          </View>
        </View>

        {/* Settings Sections */}
        <View className="gap-4">
          {/* Appearance */}
          <View className="bg-card rounded-xl overflow-hidden">
            <Text className="text-sm text-muted-foreground p-4 pb-2">
              {t('appearance')}
            </Text>
            <Pressable
              onPress={toggleTheme}
              className="flex-row items-center justify-between p-4 active:bg-secondary/50"
            >
              <View className="flex-row items-center">
                {isDark ? (
                  <Moon size={20} color="rgb(148, 163, 184)" />
                ) : (
                  <Sun size={20} color="rgb(212, 175, 55)" />
                )}
                <Text className="text-foreground ml-3">{t('theme')}</Text>
              </View>
              <Text className="text-muted-foreground">
                {isDark ? t('dark') : t('light')}
              </Text>
            </Pressable>
          </View>

          {/* Language */}
          <View className="bg-card rounded-xl overflow-hidden">
            <Text className="text-sm text-muted-foreground p-4 pb-2">
              {t('language')}
            </Text>
            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => setLanguage(lang.code)}
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
          </View>

          {/* Finance Management */}
          <View className="bg-card rounded-xl overflow-hidden">
            <Text className="text-sm text-muted-foreground p-4 pb-2">
              {t('financeManagement')}
            </Text>
            <Pressable
              onPress={() => router.push('/budgets')}
              className="flex-row items-center justify-between p-4 active:bg-secondary/50"
            >
              <View className="flex-row items-center">
                <Wallet size={20} color="rgb(212, 175, 55)" />
                <Text className="text-foreground ml-3">{t('budgets')}</Text>
              </View>
              <ChevronRight size={20} color="rgb(148, 163, 184)" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/recurring')}
              className="flex-row items-center justify-between p-4 active:bg-secondary/50"
            >
              <View className="flex-row items-center">
                <Repeat size={20} color="rgb(212, 175, 55)" />
                <Text className="text-foreground ml-3">{t('recurringTransactions')}</Text>
              </View>
              <ChevronRight size={20} color="rgb(148, 163, 184)" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/subscriptions')}
              className="flex-row items-center justify-between p-4 active:bg-secondary/50"
            >
              <View className="flex-row items-center">
                <CreditCard size={20} color="rgb(212, 175, 55)" />
                <Text className="text-foreground ml-3">{t('subscriptions')}</Text>
              </View>
              <ChevronRight size={20} color="rgb(148, 163, 184)" />
            </Pressable>
          </View>

          {/* Tools & Features */}
          <View className="bg-card rounded-xl overflow-hidden">
            <Text className="text-sm text-muted-foreground p-4 pb-2">
              {t('toolsAndFeatures') || 'Tools & Features'}
            </Text>
            <Pressable
              onPress={() => router.push('/badges')}
              style={{ cursor: 'pointer' }}
              className="flex-row items-center justify-between p-4 active:bg-secondary/50"
            >
              <View className="flex-row items-center">
                <Trophy size={20} color="rgb(212, 175, 55)" />
                <Text className="text-foreground ml-3">{t('badges') || 'Badges'}</Text>
              </View>
              <ChevronRight size={20} color="rgb(148, 163, 184)" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/historical')}
              style={{ cursor: 'pointer' }}
              className="flex-row items-center justify-between p-4 active:bg-secondary/50"
            >
              <View className="flex-row items-center">
                <History size={20} color="rgb(212, 175, 55)" />
                <Text className="text-foreground ml-3">{t('historicalRates') || 'Historical Rates'}</Text>
              </View>
              <ChevronRight size={20} color="rgb(148, 163, 184)" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(public)/about')}
              style={{ cursor: 'pointer' }}
              className="flex-row items-center justify-between p-4 active:bg-secondary/50"
            >
              <View className="flex-row items-center">
                <Info size={20} color="rgb(148, 163, 184)" />
                <Text className="text-foreground ml-3">{t('aboutUs') || 'About Us'}</Text>
              </View>
              <ChevronRight size={20} color="rgb(148, 163, 184)" />
            </Pressable>
          </View>

          {/* Account */}
          <View className="bg-card rounded-xl overflow-hidden">
            <Text className="text-sm text-muted-foreground p-4 pb-2">
              {t('account')}
            </Text>
            <Pressable
              style={{ cursor: 'pointer' }}
              className="flex-row items-center justify-between p-4 active:bg-secondary/50"
            >
              <View className="flex-row items-center">
                <Shield size={20} color="rgb(148, 163, 184)" />
                <Text className="text-foreground ml-3">{t('security')}</Text>
              </View>
              <ChevronRight size={20} color="rgb(148, 163, 184)" />
            </Pressable>
            <Pressable
              style={{ cursor: 'pointer' }}
              className="flex-row items-center justify-between p-4 active:bg-secondary/50"
            >
              <View className="flex-row items-center">
                <Bell size={20} color="rgb(148, 163, 184)" />
                <Text className="text-foreground ml-3">{t('notifications')}</Text>
              </View>
              <ChevronRight size={20} color="rgb(148, 163, 184)" />
            </Pressable>
          </View>

          {/* Logout */}
          <Pressable
            onPress={handleLogout}
            className="bg-danger/10 p-4 rounded-xl flex-row items-center justify-center"
          >
            <LogOut size={20} color="rgb(220, 38, 38)" />
            <Text className="text-danger font-semibold ml-2">{t('logout')}</Text>
          </Pressable>
        </View>

        {/* App Info */}
        <View className="items-center mt-8">
          <Text className="text-muted-foreground">CoFinance v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
