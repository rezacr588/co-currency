import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeftRight, Wallet, Target, BarChart3, Menu, Moon, Sun, User } from 'lucide-react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from '../../src/context/ThemeContext';

export default function HomeScreen() {
  const { t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Desktop/Tablet Navbar */}
      {isTablet && (
        <View className="bg-card border-b border-border px-6 py-4 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-primary">CoFinance</Text>
          <View className="flex-row items-center gap-4">
            <Link href="/converter" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="px-4 py-2">
                <Text className="text-foreground font-medium">{t('converterTitle')}</Text>
              </Pressable>
            </Link>
            <Pressable onPress={toggleTheme} style={{ cursor: 'pointer' }} className="p-2">
              {isDark ? (
                <Sun size={20} color="rgb(212, 175, 55)" />
              ) : (
                <Moon size={20} color="rgb(148, 163, 184)" />
              )}
            </Pressable>
            <Link href="/login" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="bg-primary px-4 py-2 rounded-lg">
                <Text className="text-white font-semibold">{t('login')}</Text>
              </Pressable>
            </Link>
            <Link href="/register" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="bg-secondary px-4 py-2 rounded-lg">
                <Text className="text-foreground font-semibold">{t('register')}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 48 : 24,
          maxWidth: isDesktop ? 1200 : undefined,
          alignSelf: isDesktop ? 'center' : undefined,
          width: '100%',
        }}
      >
        {/* Mobile Header */}
        {!isTablet && (
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-2xl font-bold text-primary">CoFinance</Text>
            <Pressable onPress={toggleTheme} style={{ cursor: 'pointer' }} className="p-2">
              {isDark ? (
                <Sun size={20} color="rgb(212, 175, 55)" />
              ) : (
                <Moon size={20} color="rgb(148, 163, 184)" />
              )}
            </Pressable>
          </View>
        )}

        {/* Hero Section */}
        <View
          className="items-center"
          style={{
            paddingVertical: isDesktop ? 80 : 48,
          }}
        >
          <Text
            className="font-bold text-foreground mb-4 text-center"
            style={{ fontSize: isDesktop ? 56 : 36 }}
          >
            CoFinance
          </Text>
          <Text
            className="text-muted-foreground text-center mb-8"
            style={{
              fontSize: isDesktop ? 20 : 16,
              maxWidth: isDesktop ? 600 : undefined,
            }}
          >
            {t('heroSubtitle')}
          </Text>

          {/* Mobile CTA Buttons */}
          {!isTablet && (
            <View className="flex-row gap-4">
              <Link href="/login" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="bg-primary px-6 py-3 rounded-xl">
                  <Text className="text-white font-semibold">{t('login')}</Text>
                </Pressable>
              </Link>
              <Link href="/register" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="bg-secondary px-6 py-3 rounded-xl">
                  <Text className="text-foreground font-semibold">{t('register')}</Text>
                </Pressable>
              </Link>
            </View>
          )}

          {/* Desktop Hero CTA */}
          {isDesktop && (
            <View className="flex-row gap-4 mt-4">
              <Link href="/register" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="bg-primary px-8 py-4 rounded-xl">
                  <Text className="text-white font-bold text-lg">{t('getStarted') || 'Get Started'}</Text>
                </Pressable>
              </Link>
              <Link href="/converter" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="bg-secondary px-8 py-4 rounded-xl">
                  <Text className="text-foreground font-bold text-lg">{t('tryConverter')}</Text>
                </Pressable>
              </Link>
            </View>
          )}
        </View>

        {/* Features Grid */}
        <View style={{ marginTop: isDesktop ? 48 : 24 }}>
          <Text
            className="font-bold text-foreground mb-6 text-center"
            style={{ fontSize: isDesktop ? 32 : 24 }}
          >
            {t('features')}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: isDesktop ? 24 : 16,
              justifyContent: 'center',
            }}
          >
            <FeatureCard
              icon={<ArrowLeftRight size={isDesktop ? 40 : 32} color="rgb(212, 175, 55)" />}
              title={t('converterTitle')}
              description={t('converterDescription')}
              isDesktop={isDesktop}
            />
            <FeatureCard
              icon={<Wallet size={isDesktop ? 40 : 32} color="rgb(16, 185, 129)" />}
              title={t('wallet')}
              description={t('walletDescription')}
              isDesktop={isDesktop}
            />
            <FeatureCard
              icon={<Target size={isDesktop ? 40 : 32} color="rgb(59, 130, 246)" />}
              title={t('financialGoals')}
              description={t('goalsDescription')}
              isDesktop={isDesktop}
            />
            <FeatureCard
              icon={<BarChart3 size={isDesktop ? 40 : 32} color="rgb(168, 85, 247)" />}
              title={t('reportsAndStats')}
              description={t('reportsDescription')}
              isDesktop={isDesktop}
            />
          </View>
        </View>

        {/* CTA Section */}
        <View
          className="items-center"
          style={{
            paddingVertical: isDesktop ? 64 : 48,
            marginTop: isDesktop ? 48 : 24,
          }}
        >
          <Link href="/converter" asChild>
            <Pressable style={{ cursor: 'pointer' }} className="bg-accent px-8 py-4 rounded-xl">
              <Text className="text-accent-foreground font-bold text-lg">
                {t('tryConverter')}
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  isDesktop,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  isDesktop: boolean;
}) {
  return (
    <View
      className="bg-card rounded-xl"
      style={{
        padding: isDesktop ? 32 : 24,
        width: isDesktop ? 260 : '100%',
        minWidth: isDesktop ? 260 : 150,
        flex: isDesktop ? undefined : 1,
      }}
    >
      <View className="mb-4">{icon}</View>
      <Text
        className="font-semibold text-foreground mb-2"
        style={{ fontSize: isDesktop ? 20 : 18 }}
      >
        {title}
      </Text>
      <Text className="text-muted-foreground" style={{ fontSize: isDesktop ? 15 : 14 }}>
        {description}
      </Text>
    </View>
  );
}
