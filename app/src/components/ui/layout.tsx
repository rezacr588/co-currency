import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Link, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useTheme as useAppTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { resolveResponsiveToken } from '../../theme';
import { Card } from './Card';

interface PageScaffoldProps {
  children: ReactNode;
  narrow?: boolean;
  padded?: boolean;
  scroll?: boolean;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  safeAreaEdges?: Edge[];
  scrollProps?: Omit<ScrollViewProps, 'style' | 'contentContainerStyle'>;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: Href;
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface SectionBlockProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface AuthScaffoldProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}

interface MarketingScaffoldProps {
  children: ReactNode;
}

function resolveGutter(width: number, pageGutter: ReturnType<typeof getThemePageGutter>) {
  return resolveResponsiveToken(pageGutter, width);
}

function getThemePageGutter(theme: ReturnType<typeof useTheme>) {
  return theme.layout.pageGutter;
}

export function PageScaffold({
  children,
  narrow = false,
  padded = true,
  scroll = true,
  maxWidth,
  style,
  contentContainerStyle,
  safeAreaEdges,
  scrollProps,
}: PageScaffoldProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const defaultEdges: Edge[] = safeAreaEdges ?? (width >= 768 ? [] : ['top']);
  const gutter = padded ? resolveGutter(width, getThemePageGutter(theme)) : 0;
  const resolvedMaxWidth =
    maxWidth ?? (narrow ? theme.layout.maxReadingWidth : theme.layout.maxContentWidth);

  const sharedStyle: ViewStyle = {
    width: '100%',
    maxWidth: resolvedMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: gutter,
    paddingTop: padded ? theme.spacing.lg : 0,
    paddingBottom: padded ? theme.spacing.lg : 0,
  };

  if (scroll) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }, style]} edges={defaultEdges}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
          contentContainerStyle={[sharedStyle, contentContainerStyle]}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }, style]} edges={defaultEdges}>
      <View style={[{ flex: 1 }, sharedStyle, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
}

export function PageHeader({ title, subtitle, backHref, actions, style }: PageHeaderProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const titleSize = isDesktop ? 32 : 24;
  const titleLineHeight = isDesktop ? 40 : 32;
  const sectionGap = resolveResponsiveToken(theme.layout.sectionGap, width);
  const BackIcon = theme.isRTL ? ChevronRight : ChevronLeft;

  return (
    <View
      style={[
        {
          minHeight: theme.layout.headerHeight,
          marginBottom: sectionGap,
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', flex: 1, alignItems: 'flex-start', gap: theme.spacing.md }}>
        {backHref ? (
          <Link href={backHref} asChild>
            <Pressable
              hitSlop={8}
              style={({ pressed }) => [
                {
                  width: 40,
                  height: 40,
                  borderRadius: theme.radii.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                pressed && { opacity: 0.72 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <BackIcon size={18} color={theme.colors.foreground} />
            </Pressable>
          </Link>
        ) : null}

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: titleSize,
              lineHeight: titleLineHeight,
              fontFamily: theme.typography.h1.fontFamily,
              color: theme.colors.foreground,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                marginTop: theme.spacing.xs,
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
                color: theme.colors.mutedForeground,
                maxWidth: theme.layout.maxReadingWidth,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {actions ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>{actions}</View>
      ) : null}
    </View>
  );
}

export function SectionBlock({ title, subtitle, action, children, style }: SectionBlockProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const sectionGap = resolveResponsiveToken(theme.layout.sectionGap, width);

  return (
    <View style={[{ marginBottom: sectionGap }, style]}>
      {title || subtitle || action ? (
        <View
          style={{
            marginBottom: theme.spacing.lg,
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            {title ? (
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 24,
                  fontFamily: theme.typography.h2.fontFamily,
                  color: theme.colors.foreground,
                }}
              >
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text
                style={{
                  marginTop: theme.spacing.xs,
                  fontSize: theme.typography.body.fontSize,
                  lineHeight: theme.typography.body.lineHeight,
                  color: theme.colors.mutedForeground,
                  maxWidth: theme.layout.maxReadingWidth,
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          {action ? <View>{action}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function AuthScaffold({ title, subtitle, footer, children }: AuthScaffoldProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 768;
  const gutter = resolveGutter(width, getThemePageGutter(theme));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={isTablet ? [] : ['top'] as Edge[]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: gutter,
            paddingTop: theme.spacing.xxxl,
            paddingBottom: theme.spacing.xxxl + insets.bottom,
          }}
        >
          <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
            <Link href="/" asChild>
              <Pressable
                style={({ pressed }) => [
                  { alignSelf: 'center', marginBottom: theme.spacing.xxl },
                  pressed && { opacity: 0.72 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Go to home"
              >
                <Text
                  style={{
                    fontSize: 20,
                    lineHeight: 28,
                    fontFamily: theme.typography.h1.fontFamily,
                    color: theme.colors.foreground,
                  }}
                >
                  CoFinance
                </Text>
              </Pressable>
            </Link>

            <Card variant="elevated" style={{ padding: isTablet ? theme.spacing.xxl : theme.spacing.lg }}>
              <View style={{ alignItems: 'center', marginBottom: theme.spacing.xxl }}>
                <Text
                  style={{
                    fontSize: 24,
                    lineHeight: 32,
                    fontFamily: theme.typography.h1.fontFamily,
                    color: theme.colors.foreground,
                    textAlign: 'center',
                  }}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    style={{
                      marginTop: theme.spacing.sm,
                      fontSize: theme.typography.body.fontSize,
                      lineHeight: theme.typography.body.lineHeight,
                      color: theme.colors.mutedForeground,
                      textAlign: 'center',
                    }}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {children}
            </Card>

            {footer ? <View style={{ marginTop: theme.spacing.lg }}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MarketingNavLink({ href, label }: { href: Href; label: string }) {
  const theme = useTheme();

  return (
    <Link href={href} asChild>
      <Pressable
        style={({ pressed }) => [
          { minHeight: 40, justifyContent: 'center', paddingHorizontal: theme.spacing.sm },
          pressed && { opacity: 0.72 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: theme.typography.bodyMedium.fontFamily,
            fontSize: 14,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

export function MarketingScaffold({ children }: MarketingScaffoldProps) {
  const theme = useTheme();
  const { isDark, toggleTheme } = useAppTheme();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 768;
  const gutter = resolveGutter(width, getThemePageGutter(theme));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={isTablet ? [] : ['top'] as Edge[]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: theme.spacing.xxxl + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }}>
          <View
            style={{
              width: '100%',
              maxWidth: theme.layout.maxContentWidth,
              minHeight: theme.layout.headerHeight,
              alignSelf: 'center',
              paddingHorizontal: gutter,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <Link href="/" asChild>
              <Pressable
                style={({ pressed }) => [pressed && { opacity: 0.72 }]}
                accessibilityRole="button"
                accessibilityLabel="Go to home"
              >
                <Text
                  style={{
                    fontSize: 20,
                    lineHeight: 28,
                    fontFamily: theme.typography.h1.fontFamily,
                    color: theme.colors.foreground,
                  }}
                >
                  CoFinance
                </Text>
              </Pressable>
            </Link>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              {isTablet ? (
                <>
                  <MarketingNavLink href="/converter" label={t('converterTitle') || 'Converter'} />
                  <MarketingNavLink href="/about" label={t('aboutUs') || 'About'} />
                </>
              ) : null}

              <Pressable
                onPress={toggleTheme}
                style={({ pressed }) => [
                  {
                    width: 40,
                    height: 40,
                    borderRadius: theme.radii.md,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  pressed && { opacity: 0.72 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <Sun size={18} color={theme.colors.foreground} />
                ) : (
                  <Moon size={18} color={theme.colors.foreground} />
                )}
              </Pressable>

              {isTablet ? (
                <>
                  <Link href="/login" asChild>
                    <Pressable
                      style={({ pressed }) => [
                        {
                          minHeight: 40,
                          justifyContent: 'center',
                          paddingHorizontal: theme.spacing.md,
                        },
                        pressed && { opacity: 0.72 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t('login')}
                    >
                      <Text
                        style={{
                          color: theme.colors.foreground,
                          fontFamily: theme.typography.bodyMedium.fontFamily,
                          fontSize: 14,
                        }}
                      >
                        {t('login')}
                      </Text>
                    </Pressable>
                  </Link>

                  <Link href="/register" asChild>
                    <Pressable
                      style={({ pressed }) => [
                        {
                          minHeight: 40,
                          borderRadius: theme.radii.md,
                          backgroundColor: theme.colors.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: theme.spacing.md,
                        },
                        theme.shadows.sm,
                        pressed && { opacity: 0.72 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t('register')}
                    >
                      <Text
                        style={{
                          color: theme.colors.primaryForeground,
                          fontFamily: theme.typography.bodyMedium.fontFamily,
                          fontSize: 14,
                        }}
                      >
                        {t('register')}
                      </Text>
                    </Pressable>
                  </Link>
                </>
              ) : null}
            </View>
          </View>
        </View>

        <View
          style={{
            width: '100%',
            maxWidth: theme.layout.maxContentWidth,
            alignSelf: 'center',
            paddingHorizontal: gutter,
            paddingTop: theme.spacing.xxxl,
          }}
        >
          {children}
        </View>

        <View
          style={{
            marginTop: theme.spacing.xxxl,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: theme.layout.maxContentWidth,
              alignSelf: 'center',
              paddingHorizontal: gutter,
              paddingVertical: theme.spacing.xxl,
              gap: theme.spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                lineHeight: 24,
                fontFamily: theme.typography.h2.fontFamily,
                color: theme.colors.foreground,
              }}
            >
              CoFinance
            </Text>
            <Text
              style={{
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
                color: theme.colors.mutedForeground,
                maxWidth: theme.layout.maxReadingWidth,
              }}
            >
              {t('heroSubtitle') || 'Personal finance planning across currencies, goals, and reports.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export const SurfaceCard = Card;
