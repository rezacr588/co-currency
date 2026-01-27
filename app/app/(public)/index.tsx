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
        <View className="bg-background border-b border-border px-6 py-4 flex-row items-center justify-between">
          <Text className="text-xl font-semibold text-foreground">CoFinance</Text>
          <View className="flex-row items-center gap-3">
            <Link href="/converter" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="px-4 py-2">
                <Text className="text-muted-foreground text-sm font-medium hover:text-foreground">{t('converterTitle')}</Text>
              </Pressable>
            </Link>
            <Pressable onPress={toggleTheme} style={{ cursor: 'pointer' }} className="p-2 hover:bg-secondary rounded-md border border-border">
              {isDark ? (
                <Sun size={18} color="#a1a1aa" />
              ) : (
                <Moon size={18} color="#71717a" />
              )}
            </Pressable>
            <Link href="/login" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="border border-border px-4 py-2 rounded-md hover:bg-secondary">
                <Text className="text-foreground text-sm font-medium">{t('login')}</Text>
              </Pressable>
            </Link>
            <Link href="/register" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="bg-foreground px-4 py-2 rounded-md">
                <Text className="text-background text-sm font-semibold">{t('register')}</Text>
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
            <Text className="text-xl font-semibold text-foreground">CoFinance</Text>
            <Pressable onPress={toggleTheme} style={{ cursor: 'pointer' }} className="p-2 border border-border rounded-md">
              {isDark ? (
                <Sun size={18} color="#a1a1aa" />
              ) : (
                <Moon size={18} color="#71717a" />
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
            style={{ fontSize: isDesktop ? 48 : 32, letterSpacing: -1 }}
          >
            CoFinance
          </Text>
          <Text
            className="text-muted-foreground text-center mb-8"
            style={{
              fontSize: isDesktop ? 18 : 15,
              maxWidth: isDesktop ? 500 : undefined,
              lineHeight: isDesktop ? 28 : 24,
            }}
          >
            {t('heroSubtitle')}
          </Text>

          {/* Mobile CTA Buttons */}
          {!isTablet && (
            <View className="flex-row gap-3">
              <Link href="/login" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="border border-border px-5 py-3 rounded-lg">
                  <Text className="text-foreground font-medium text-sm">{t('login')}</Text>
                </Pressable>
              </Link>
              <Link href="/register" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="bg-foreground px-5 py-3 rounded-lg">
                  <Text className="text-background font-semibold text-sm">{t('register')}</Text>
                </Pressable>
              </Link>
            </View>
          )}

          {/* Desktop Hero CTA */}
          {isDesktop && (
            <View className="flex-row gap-4 mt-4">
              <Link href="/register" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="bg-foreground px-8 py-4 rounded-lg">
                  <Text className="text-background font-semibold">{t('getStarted') || 'Get Started'}</Text>
                </Pressable>
              </Link>
              <Link href="/converter" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="border border-border px-8 py-4 rounded-lg hover:bg-secondary">
                  <Text className="text-foreground font-medium">{t('tryConverter')}</Text>
                </Pressable>
              </Link>
            </View>
          )}
        </View>

        {/* Features Grid */}
        <View style={{ marginTop: isDesktop ? 48 : 24 }}>
          <Text
            className="font-semibold text-foreground mb-6 text-center"
            style={{ fontSize: isDesktop ? 24 : 20 }}
          >
            {t('features')}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: isDesktop ? 16 : 12,
              justifyContent: 'center',
            }}
          >
            <FeatureCard
              icon={<ArrowLeftRight size={isDesktop ? 28 : 24} color="#a1a1aa" />}
              title={t('converterTitle')}
              description={t('converterDescription')}
              isDesktop={isDesktop}
            />
            <FeatureCard
              icon={<Wallet size={isDesktop ? 28 : 24} color="#a1a1aa" />}
              title={t('wallet')}
              description={t('walletDescription')}
              isDesktop={isDesktop}
            />
            <FeatureCard
              icon={<Target size={isDesktop ? 28 : 24} color="#a1a1aa" />}
              title={t('financialGoals')}
              description={t('goalsDescription')}
              isDesktop={isDesktop}
            />
            <FeatureCard
              icon={<BarChart3 size={isDesktop ? 28 : 24} color="#a1a1aa" />}
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
            <Pressable style={{ cursor: 'pointer' }} className="bg-accent px-6 py-3 rounded-lg">
              <Text className="text-accent-foreground font-semibold">
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
      className="bg-card border border-border rounded-lg"
      style={{
        padding: isDesktop ? 24 : 20,
        width: isDesktop ? 240 : '100%',
        minWidth: isDesktop ? 240 : 150,
        flex: isDesktop ? undefined : 1,
      }}
    >
      <View className="mb-3 bg-secondary p-2.5 rounded-md self-start">{icon}</View>
      <Text
        className="font-medium text-foreground mb-1.5"
        style={{ fontSize: isDesktop ? 16 : 15 }}
      >
        {title}
      </Text>
      <Text className="text-muted-foreground" style={{ fontSize: isDesktop ? 13 : 13, lineHeight: 20 }}>
        {description}
      </Text>
    </View>
  );
}
