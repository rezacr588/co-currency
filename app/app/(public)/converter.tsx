import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Moon, Sun } from 'lucide-react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from '../../src/context/ThemeContext';
import { CurrencyConverter } from '../../src/components/features/CurrencyConverter';

export default function ConverterScreen() {
  const { t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 24;
  const iconColor = isDark ? 'rgb(248, 250, 252)' : 'rgb(148, 163, 184)';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Desktop/Tablet Navbar */}
      {isTablet && (
        <View className="bg-card border-b border-border px-6 py-4 flex-row items-center justify-between">
          <Link href="/" asChild>
            <Pressable style={{ cursor: 'pointer' }} className="flex-row items-center">
              <Text className="text-2xl font-bold text-primary">CoFinance</Text>
            </Pressable>
          </Link>
          <View className="flex-row items-center gap-4">
            <Pressable onPress={toggleTheme} style={{ cursor: 'pointer' }} className="p-2">
              {isDark ? (
                <Sun size={20} color="rgb(212, 175, 55)" />
              ) : (
                <Moon size={20} color="rgb(148, 163, 184)" />
              )}
            </Pressable>
            <Link href="/login" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="bg-primary px-4 py-2 rounded-lg">
                <Text className="text-primary-foreground font-semibold">{t('login')}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      )}

      <ScrollView
        className="flex-1"
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
              <Pressable style={{ cursor: 'pointer' }} className="flex-row items-center mb-6" hitSlop={10}>
                <ArrowLeft size={20} color={iconColor} />
                <Text className="text-muted-foreground ml-2">{t('back') || 'Back'}</Text>
              </Pressable>
            </Link>
          )}

          <Text
            className="font-bold text-foreground mb-2"
            style={{ fontSize: isDesktop ? 36 : 28 }}
          >
            {t('converterTitle')}
          </Text>
          <Text className="text-muted-foreground mb-8">
            {t('converterSubtitle')}
          </Text>

          <CurrencyConverter variant="full" showQuickSelect={false} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
