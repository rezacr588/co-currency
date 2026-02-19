import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Moon, Sun } from 'lucide-react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useTheme as useStyledTheme } from 'styled-components/native';
import { CurrencyConverter } from '../../src/components/features/CurrencyConverter';

export default function ConverterScreen() {
  const { t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 24;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Desktop/Tablet Navbar */}
      {isTablet && (
        <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" asChild>
            <Pressable style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.primary }}>CoFinance</Text>
            </Pressable>
          </Link>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable onPress={toggleTheme} style={{ cursor: 'pointer', padding: 8 }}>
              {isDark ? (
                <Sun size={20} color={colors.accent} />
              ) : (
                <Moon size={20} color={colors.mutedForeground} />
              )}
            </Pressable>
            <Link href="/login" asChild>
              <Pressable style={{ cursor: 'pointer', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>{t('login')}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: isDesktop ? 48 : 24,
          alignItems: 'center',
          paddingBottom: bottomPadding,
        }}
      >
        <View style={{ width: '100%', maxWidth: isDesktop ? 500 : undefined }}>
          {/* Mobile Header */}
          {!isTablet && (
            <Link href="/" asChild>
              <Pressable style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', marginBottom: 24 }} hitSlop={10}>
                <ArrowLeft size={20} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, marginLeft: 8 }}>{t('back') || 'Back'}</Text>
              </Pressable>
            </Link>
          )}

          <Text
            style={{ fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 8, fontSize: isDesktop ? 36 : 28 }}
          >
            {t('converterTitle')}
          </Text>
          <Text style={{ color: colors.mutedForeground, marginBottom: 32 }}>
            {t('converterSubtitle')}
          </Text>

          <CurrencyConverter variant="full" showQuickSelect={false} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
