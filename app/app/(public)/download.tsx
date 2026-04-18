import { Linking, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Redirect } from 'expo-router';
import { Download, Monitor, Shield, Smartphone, Wifi, WifiOff, Zap, Bell } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../src/context/LanguageContext';
import { MarketingScaffold, SectionBlock, SurfaceCard } from '../../src/components/ui';
import { SEOHead } from '../../src/components/seo';

const APK_URL = 'https://github.com/rezacr588/co-currency/releases/download/latest/coai.apk';

function DownloadButton({ url, label }: { url: string; label: string }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          minHeight: 56,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.primary,
          paddingHorizontal: 32,
          paddingVertical: 14,
        },
        theme.shadows.md,
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Download size={20} color={theme.colors.primaryForeground} />
      <Text style={{ color: theme.colors.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: theme.colors.accent + '22',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.colors.accent, fontFamily: 'Inter_700Bold', fontSize: 13 }}>{number}</Text>
      </View>
      <Text style={{ flex: 1, color: theme.colors.foreground, fontSize: 15, lineHeight: 22, paddingTop: 3 }}>
        {text}
      </Text>
    </View>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      {icon}
      <Text style={{ color: theme.colors.foreground, fontSize: 15 }}>{text}</Text>
    </View>
  );
}

export default function DownloadScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // On native, redirect to app — download page is web-only
  if (Platform.OS !== 'web') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <MarketingScaffold>
      <SEOHead
        title={t('downloadTitle') || 'Download CoAI'}
        description={t('downloadSubtitle') || 'Get the CoAI app on your Android device for the best experience.'}
        canonicalPath="/download"
      />

      {/* Hero */}
      <View style={{ alignItems: 'center', paddingTop: theme.spacing.xxxl, paddingBottom: theme.spacing.xl }}>
        <Text
          style={{
            fontSize: isTablet ? 40 : 32,
            lineHeight: isTablet ? 48 : 40,
            fontFamily: theme.typography.h1.fontFamily,
            color: theme.colors.foreground,
            textAlign: 'center',
          }}
        >
          {t('downloadTitle') || 'Download CoAI'}
        </Text>
        <Text
          style={{
            marginTop: theme.spacing.md,
            fontSize: 16,
            lineHeight: 24,
            color: theme.colors.mutedForeground,
            textAlign: 'center',
            maxWidth: 480,
          }}
        >
          {t('downloadSubtitle') || 'Get the mobile app for the best experience — offline access, push notifications, and biometric security.'}
        </Text>
      </View>

      {/* Download Cards */}
      <View
        style={{
          flexDirection: isTablet ? 'row' : 'column',
          gap: theme.spacing.lg,
          marginBottom: theme.spacing.xxxl,
        }}
      >
        {/* Android */}
        <SurfaceCard style={{ flex: 1, alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: theme.alpha('#3ddc84', 0.133),
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: theme.spacing.lg,
            }}
          >
            <Smartphone size={32} color="#3ddc84" />
          </View>
          <Text style={{ fontSize: 22, fontFamily: theme.typography.h2.fontFamily, color: theme.colors.foreground }}>
            Android
          </Text>
          <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.mutedForeground, fontSize: 14, textAlign: 'center' }}>
            {t('downloadAndroidDesc') || 'Download the APK and install directly on your device.'}
          </Text>
          <View style={{ marginTop: theme.spacing.xl, width: '100%', maxWidth: 280 }}>
            <DownloadButton url={APK_URL} label={t('downloadAPKButton') || 'Download APK'} />
          </View>
        </SurfaceCard>

        {/* iOS */}
        <SurfaceCard style={{ flex: 1, alignItems: 'center', paddingVertical: theme.spacing.xxl, opacity: 0.6 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: theme.colors.mutedForeground + '22',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: theme.spacing.lg,
            }}
          >
            <Smartphone size={32} color={theme.colors.mutedForeground} />
          </View>
          <Text style={{ fontSize: 22, fontFamily: theme.typography.h2.fontFamily, color: theme.colors.foreground }}>
            iOS
          </Text>
          <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.mutedForeground, fontSize: 14, textAlign: 'center' }}>
            {t('downloadIOSComingSoon') || 'iOS app coming soon. Use the web app in the meantime.'}
          </Text>
          <View style={{ marginTop: theme.spacing.xl, width: '100%', maxWidth: 280 }}>
            <Pressable
              onPress={() => Linking.openURL('/login')}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  minHeight: 56,
                  borderRadius: theme.radii.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                  paddingHorizontal: 32,
                  paddingVertical: 14,
                },
                pressed && { opacity: 0.72 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('downloadUseWeb') || 'Use Web App'}
            >
              <Monitor size={20} color={theme.colors.foreground} />
              <Text style={{ color: theme.colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 17 }}>
                {t('downloadUseWeb') || 'Use Web App'}
              </Text>
            </Pressable>
          </View>
        </SurfaceCard>
      </View>

      {/* Installation Guide */}
      <SectionBlock title={t('downloadInstallGuide') || 'Installation Guide'}>
        <SurfaceCard>
          <View style={{ gap: 16 }}>
            <Step number={1} text={t('downloadStep1') || 'Tap "Download APK" above to download the file.'} />
            <Step number={2} text={t('downloadStep2') || 'Open the downloaded file from your notifications or file manager.'} />
            <Step number={3} text={t('downloadStep3') || 'If prompted, allow installation from unknown sources in your device settings.'} />
            <Step number={4} text={t('downloadStep4') || 'Install and open CoAI. Sign in with your existing account or create a new one.'} />
          </View>
        </SurfaceCard>
      </SectionBlock>

      {/* Why the app? */}
      <SectionBlock title={t('downloadWhyApp') || 'Why use the app?'}>
        <SurfaceCard>
          <View style={{ gap: 4 }}>
            <FeatureRow
              icon={<WifiOff size={18} color={theme.colors.accent} />}
              text={t('downloadOffline') || 'Works offline — track expenses without internet'}
            />
            <FeatureRow
              icon={<Bell size={18} color={theme.colors.accent} />}
              text={t('downloadNotifications') || 'Push notifications for budget alerts and reminders'}
            />
            <FeatureRow
              icon={<Shield size={18} color={theme.colors.accent} />}
              text={t('downloadBiometric') || 'Biometric lock — Face ID or fingerprint security'}
            />
            <FeatureRow
              icon={<Zap size={18} color={theme.colors.accent} />}
              text={t('downloadFaster') || 'Faster performance with native rendering'}
            />
          </View>
        </SurfaceCard>
      </SectionBlock>
    </MarketingScaffold>
  );
}
