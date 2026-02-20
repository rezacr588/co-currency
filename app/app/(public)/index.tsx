import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeftRight, Wallet, Target, BarChart3, Menu, Moon, Sun, User } from 'lucide-react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useTheme as useStyledTheme } from 'styled-components/native';

export default function HomeScreen() {
  const { t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const { width } = useWindowDimensions();
  const router = useRouter();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Desktop/Tablet Navbar */}
      {isTablet && (
        <View style={{ backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>CoFinance</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Link href="/converter" asChild>
              <Pressable style={{ cursor: 'pointer', paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: 'Inter_500Medium' }}>{t('converterTitle')}</Text>
              </Pressable>
            </Link>
            <Pressable onPress={toggleTheme} style={{ cursor: 'pointer', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
              {isDark ? (
                <Sun size={18} color={colors.secondaryForeground} />
              ) : (
                <Moon size={18} color={colors.mutedForeground} />
              )}
            </Pressable>
            <Link href="/login" asChild>
              <Pressable style={{ cursor: 'pointer', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }}>{t('login')}</Text>
              </Pressable>
            </Link>
            <Link href="/register" asChild>
              <Pressable style={{ cursor: 'pointer', backgroundColor: colors.foreground, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}>
                <Text style={{ color: colors.background, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>{t('register')}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isDesktop ? 48 : 24,
          maxWidth: isDesktop ? 1200 : undefined,
          alignSelf: isDesktop ? 'center' : undefined,
          width: '100%',
        }}
      >
        {/* Mobile Header */}
        {!isTablet && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>CoFinance</Text>
            <Pressable onPress={toggleTheme} style={{ cursor: 'pointer', padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 6 }}>
              {isDark ? (
                <Sun size={18} color={colors.secondaryForeground} />
              ) : (
                <Moon size={18} color={colors.mutedForeground} />
              )}
            </Pressable>
          </View>
        )}

        {/* Hero Section */}
        <View
          style={{
            alignItems: 'center',
            paddingVertical: isDesktop ? 80 : 48,
          }}
        >
          <Text
            style={{ fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 16, textAlign: 'center', fontSize: isDesktop ? 48 : 32, letterSpacing: -1 }}
          >
            CoFinance
          </Text>
          <Text
            style={{
              color: colors.mutedForeground, textAlign: 'center', marginBottom: 32,
              fontSize: isDesktop ? 18 : 15,
              maxWidth: isDesktop ? 500 : undefined,
              lineHeight: isDesktop ? 28 : 24,
            }}
          >
            {t('heroSubtitle')}
          </Text>

          {/* Mobile CTA Buttons */}
          {!isTablet && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Link href="/login" asChild>
                <Pressable style={{ cursor: 'pointer', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>{t('login')}</Text>
                </Pressable>
              </Link>
              <Link href="/register" asChild>
                <Pressable style={{ cursor: 'pointer', backgroundColor: colors.foreground, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
                  <Text style={{ color: colors.background, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{t('register')}</Text>
                </Pressable>
              </Link>
            </View>
          )}

          {/* Desktop Hero CTA */}
          {isDesktop && (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
              <Link href="/register" asChild>
                <Pressable style={{ cursor: 'pointer', backgroundColor: colors.foreground, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 8 }}>
                  <Text style={{ color: colors.background, fontFamily: 'Inter_600SemiBold' }}>{t('getStarted') || 'Get Started'}</Text>
                </Pressable>
              </Link>
              <Link href="/converter" asChild>
                <Pressable style={{ cursor: 'pointer', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 8 }}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{t('tryConverter')}</Text>
                </Pressable>
              </Link>
            </View>
          )}
        </View>

        {/* Features Grid */}
        <View style={{ marginTop: isDesktop ? 48 : 24 }}>
          <Text
            style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 24, textAlign: 'center', fontSize: isDesktop ? 24 : 20 }}
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
              icon={<ArrowLeftRight size={isDesktop ? 28 : 24} color={colors.secondaryForeground} />}
              title={t('converterTitle')}
              description={t('converterDescription')}
              isDesktop={isDesktop}
            />
            <FeatureCard
              icon={<Wallet size={isDesktop ? 28 : 24} color={colors.secondaryForeground} />}
              title={t('wallet')}
              description={t('walletDescription')}
              isDesktop={isDesktop}
            />
            <FeatureCard
              icon={<Target size={isDesktop ? 28 : 24} color={colors.secondaryForeground} />}
              title={t('financialGoals')}
              description={t('goalsDescription')}
              isDesktop={isDesktop}
            />
            <FeatureCard
              icon={<BarChart3 size={isDesktop ? 28 : 24} color={colors.secondaryForeground} />}
              title={t('reportsAndStats')}
              description={t('reportsDescription')}
              isDesktop={isDesktop}
            />
          </View>
        </View>

        {/* CTA Section */}
        <View
          style={{
            alignItems: 'center',
            paddingVertical: isDesktop ? 64 : 48,
            marginTop: isDesktop ? 48 : 24,
          }}
        >
          <Link href="/converter" asChild>
            <Pressable style={{ cursor: 'pointer', backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}>
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold' }}>
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
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;

  return (
    <View
      style={{
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
        padding: isDesktop ? 24 : 20,
        width: isDesktop ? 240 : '100%',
        minWidth: isDesktop ? 240 : undefined,
        flex: undefined,
      }}
    >
      <View style={{ marginBottom: 12, backgroundColor: colors.secondary, padding: 10, borderRadius: 6, alignSelf: 'flex-start' }}>{icon}</View>
      <Text
        style={{ fontFamily: 'Inter_500Medium', color: colors.foreground, marginBottom: 6, fontSize: isDesktop ? 16 : 15 }}
      >
        {title}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: isDesktop ? 13 : 13, lineHeight: 20 }}>
        {description}
      </Text>
    </View>
  );
}
