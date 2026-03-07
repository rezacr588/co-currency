import { Image, Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import {
  BarChart3,
  Bot,
  CheckCircle,
  Globe,
  Languages,
  Moon,
  PieChart,
  RefreshCw,
  Repeat,
  Target,
  Wallet,
  Zap,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../src/context/LanguageContext';
import { LinkedInIcon } from '../../src/constants/icons';
import { MarketingScaffold, SectionBlock, SurfaceCard } from '../../src/components/ui';
import { getVersionInfo } from '../../src/utils/version';

function AboutStat({ icon, label }: { icon: React.ReactNode; label: string }) {
  const theme = useTheme();

  return (
    <SurfaceCard style={{ flex: 1, minWidth: 180, alignItems: 'center' }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.secondary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.md,
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          color: theme.colors.foreground,
          fontFamily: theme.typography.bodyMedium.fontFamily,
          fontSize: 15,
          lineHeight: 22,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </SurfaceCard>
  );
}

export default function AboutScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const versionInfo = getVersionInfo();

  const quickFeatures = [
    { icon: <Zap size={20} color={theme.colors.primary} />, label: t('featureFast') || 'Fast' },
    { icon: <CheckCircle size={20} color={theme.colors.primary} />, label: t('featureAccurate') || 'Accurate' },
    { icon: <Globe size={20} color={theme.colors.primary} />, label: t('featureGlobal') || 'Global' },
  ];

  const appFeatures = [
    { icon: <RefreshCw size={20} color={theme.colors.primary} />, label: t('currencyConverter') || 'Converter', desc: t('converterDesc') || '160+ currencies' },
    { icon: <Wallet size={20} color={theme.colors.primary} />, label: t('multiCurrencyWallet') || 'Wallet', desc: t('walletDesc') || 'Track balances' },
    { icon: <Target size={20} color={theme.colors.primary} />, label: t('financialGoals') || 'Goals', desc: t('goalsDesc') || 'Save smarter' },
    { icon: <PieChart size={20} color={theme.colors.primary} />, label: t('budgets') || 'Budgets', desc: t('budgetDesc') || 'Control spending' },
    { icon: <Repeat size={20} color={theme.colors.primary} />, label: t('recurringTransactions') || 'Recurring', desc: t('recurringDesc') || 'Automate finances' },
    { icon: <BarChart3 size={20} color={theme.colors.primary} />, label: t('reportsAndStats') || 'Reports', desc: t('reportsDesc') || 'Track progress' },
    { icon: <Bot size={20} color={theme.colors.primary} />, label: t('aiReceiptParsing') || 'AI Parsing', desc: t('aiParsingDesc') || 'Smart receipts' },
    { icon: <Moon size={20} color={theme.colors.primary} />, label: t('darkMode') || 'Dark Mode', desc: t('darkModeDesc') || 'Easy on eyes' },
    { icon: <Languages size={20} color={theme.colors.primary} />, label: t('multiLanguage') || 'Multi-Language', desc: t('multiLangDesc') || '4 languages' },
  ];

  return (
    <MarketingScaffold>
      <SectionBlock
        title={t('aboutUs') || 'About Us'}
        subtitle={t('aboutUsDescription') || 'Your complete personal finance companion'}
      >
        <SurfaceCard
          style={{
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
          }}
        >
          <Text
            style={{
              color: theme.colors.primaryForeground,
              fontSize: isDesktop ? 32 : 24,
              lineHeight: isDesktop ? 40 : 32,
              fontFamily: theme.typography.h1.fontFamily,
            }}
          >
            {t('missionDescription') || 'Empowering you to take control of your finances across currencies and borders'}
          </Text>
        </SurfaceCard>
      </SectionBlock>

      <SectionBlock title={t('features')} subtitle={t('builtWith') || 'Built with a standard product workflow in mind.'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {quickFeatures.map((feature) => (
            <AboutStat key={feature.label} icon={feature.icon} label={feature.label} />
          ))}
        </View>
      </SectionBlock>

      <SectionBlock title={t('coFounder') || 'Founder'}>
        <SurfaceCard style={{ padding: theme.spacing.xxl }}>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', alignItems: isDesktop ? 'center' : 'flex-start', gap: theme.spacing.xl }}>
            <Image
              source={{ uri: 'https://media.licdn.com/dms/image/v2/D4E03AQF3hRqdwxserA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1718006654218?e=1741219200&v=beta&t=5WdFxbGJfEfF2X5lqSwJXrwf3Fn6z7l5o5rZbKFGbhk' }}
              style={{ width: 104, height: 104, borderRadius: 999 }}
            />

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 24,
                  lineHeight: 32,
                  fontFamily: theme.typography.h1.fontFamily,
                  color: theme.colors.foreground,
                }}
              >
                Reza Zeraat
              </Text>
              <Text style={{ marginTop: 6, color: theme.colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
                Full Stack Developer & ML Engineer
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.lg }}>
                {['React', 'TypeScript', 'Go', 'Python', 'ML'].map((skill) => (
                  <View
                    key={skill}
                    style={{
                      borderRadius: theme.radii.full,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.backgroundSecondary,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: 12, lineHeight: 16 }}>{skill}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={() => Linking.openURL('https://www.linkedin.com/in/reza-zeraat-6628781b3/')}
                style={({ pressed }) => [
                  {
                    marginTop: theme.spacing.xl,
                    minHeight: 44,
                    borderRadius: theme.radii.md,
                    backgroundColor: '#0077B5',
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'flex-start',
                    gap: 8,
                  },
                  pressed && { opacity: 0.72 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('viewLinkedIn') || 'View LinkedIn'}
              >
                <LinkedInIcon size={16} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontFamily: theme.typography.bodyMedium.fontFamily, fontSize: 14 }}>
                  {t('viewLinkedIn') || 'View LinkedIn'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SurfaceCard>
      </SectionBlock>

      <SectionBlock title={t('appFeatures') || 'App Features'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {appFeatures.map((feature) => (
            <SurfaceCard key={feature.label} style={{ width: isDesktop ? '32%' : width >= 768 ? '48%' : '100%' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.secondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: theme.spacing.md,
                }}
              >
                {feature.icon}
              </View>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.h2.fontFamily, fontSize: 18, lineHeight: 24 }}>
                {feature.label}
              </Text>
              <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
                {feature.desc}
              </Text>
            </SurfaceCard>
          ))}
        </View>
      </SectionBlock>

      <SectionBlock title={t('builtWith') || 'Built with'}>
        <SurfaceCard>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['React Native', 'Expo', 'TypeScript', 'Go', 'PostgreSQL', 'Styled Components'].map((tech) => (
              <View
                key={tech}
                style={{
                  borderRadius: theme.radii.full,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.backgroundSecondary,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: theme.colors.mutedForeground, fontSize: 12, lineHeight: 16 }}>{tech}</Text>
              </View>
            ))}
          </View>
        </SurfaceCard>
      </SectionBlock>

      <SurfaceCard style={{ marginBottom: theme.spacing.xxxl }}>
        <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.h2.fontFamily, fontSize: 18, lineHeight: 24 }}>
          CoFinance
        </Text>
        <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
          {versionInfo.displayVersion}
        </Text>
        {versionInfo.updateId ? (
          <Text style={{ marginTop: 4, color: theme.colors.mutedForeground, fontSize: 12, lineHeight: 16 }}>
            Update: {versionInfo.updateId.substring(0, 8)}
          </Text>
        ) : null}
      </SurfaceCard>
    </MarketingScaffold>
  );
}
