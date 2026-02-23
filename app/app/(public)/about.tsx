import { View, Text, ScrollView, Pressable, Image, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Zap,
  CheckCircle,
  Globe,
  RefreshCw,
  Wallet,
  Target,
  PieChart,
  Repeat,
  BarChart3,
  Bot,
  Moon,
  Languages,
  ChevronLeft,
} from 'lucide-react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { LinkedInIcon } from '../../src/constants/icons';
import { getVersionInfo } from '../../src/utils/version';

export default function AboutScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const versionInfo = getVersionInfo();

  const isLargeScreen = width > 768;
  const featureColumns = width > 900 ? 3 : width > 600 ? 2 : 1;

  const quickFeatures = [
    { Icon: Zap, label: t('featureFast') || 'Fast' },
    { Icon: CheckCircle, label: t('featureAccurate') || 'Accurate' },
    { Icon: Globe, label: t('featureGlobal') || 'Global' },
  ];

  const appFeatures = [
    { Icon: RefreshCw, label: t('currencyConverter') || 'CoFinance', desc: t('converterDesc') || '160+ currencies' },
    { Icon: Wallet, label: t('multiCurrencyWallet') || 'Multi-Currency Wallet', desc: t('walletDesc') || 'Track balances' },
    { Icon: Target, label: t('financialGoals') || 'Financial Goals', desc: t('goalsDesc') || 'Save smarter' },
    { Icon: PieChart, label: t('budgets') || 'Budgets', desc: t('budgetDesc') || 'Control spending' },
    { Icon: Repeat, label: t('recurringTransactions') || 'Recurring', desc: t('recurringDesc') || 'Automate finances' },
    { Icon: BarChart3, label: t('reportsAndStats') || 'Reports', desc: t('reportsDesc') || 'Track progress' },
    { Icon: Bot, label: t('aiReceiptParsing') || 'AI Parsing', desc: t('aiParsingDesc') || 'Smart receipts' },
    { Icon: Moon, label: t('darkMode') || 'Dark Mode', desc: t('darkModeDesc') || 'Easy on eyes' },
    { Icon: Languages, label: t('multiLanguage') || 'Multi-Language', desc: t('multiLangDesc') || '4 languages' },
  ];

  const techStack = ['React Native', 'Expo', 'TypeScript', 'Go', 'PostgreSQL', 'Styled Components'];

  const openLinkedIn = () => {
    Linking.openURL('https://www.linkedin.com/in/reza-zeraat-6628781b3/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ cursor: 'pointer', padding: 8, marginRight: 8 }}
          >
            <ChevronLeft size={24} color={colors.placeholder} />
          </Pressable>
          <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {t('aboutUs') || 'About Us'}
          </Text>
        </View>

        <View style={{ maxWidth: isLargeScreen ? 800 : '100%', alignSelf: 'center', width: '100%' }}>
          {/* Description */}
          <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 24 }}>
            {t('aboutUsDescription') || 'Your complete personal finance companion'}
          </Text>

          {/* Mission Banner */}
          <View style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <Text style={{ color: colors.primaryForeground, textAlign: 'center', fontSize: 18, fontFamily: 'Inter_500Medium' }}>
              {t('missionDescription') || 'Empowering you to take control of your finances across currencies and borders'}
            </Text>
          </View>

          {/* Quick Features */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 }}>
            {quickFeatures.map((feature) => (
              <View key={feature.label} style={{ alignItems: 'center', padding: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, flex: 1, marginHorizontal: 4 }}>
                <feature.Icon size={24} color={colors.accent} />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground, marginTop: 8 }}>{feature.label}</Text>
              </View>
            ))}
          </View>

          {/* Founder Card */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 24, marginBottom: 24 }}>
            <View style={isLargeScreen ? { flexDirection: 'row', alignItems: 'center' } : undefined}>
              {/* Profile Image */}
              <View style={isLargeScreen ? { marginRight: 20 } : { alignItems: 'center', marginBottom: 16 }}>
                <Image
                  source={{ uri: 'https://media.licdn.com/dms/image/v2/D4E03AQF3hRqdwxserA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1718006654218?e=1741219200&v=beta&t=5WdFxbGJfEfF2X5lqSwJXrwf3Fn6z7l5o5rZbKFGbhk' }}
                  style={{ width: 96, height: 96, borderRadius: 9999, borderWidth: 4, borderColor: colors.accentMuted }}
                />
              </View>

              {/* Info */}
              <View style={[{ flex: 1 }, !isLargeScreen ? { alignItems: 'center' } : undefined]}>
                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }, !isLargeScreen ? { justifyContent: 'center' } : undefined]}>
                  <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>Reza Zeraat</Text>
                  <View style={{ backgroundColor: colors.primary + '33', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
                      {t('coFounder') || 'Founder'}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 12 }}>
                  Full Stack Developer & ML Engineer
                </Text>

                {/* Skills */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                  {['React', 'TypeScript', 'Go', 'Python', 'ML'].map((skill) => (
                    <View key={skill} style={{ backgroundColor: colors.muted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{skill}</Text>
                    </View>
                  ))}
                </View>

                {/* LinkedIn Button */}
                <Pressable
                  onPress={openLinkedIn}
                  style={{ cursor: 'pointer', backgroundColor: '#0077B5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                >
                  <LinkedInIcon size={16} color="white" />
                  <Text style={{ color: 'white', fontFamily: 'Inter_500Medium', marginLeft: 8 }}>
                    {t('viewLinkedIn') || 'View LinkedIn'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* App Features */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center', marginBottom: 16 }}>
              {t('appFeatures') || 'App Features'}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              {appFeatures.map((feature) => (
                <View
                  key={feature.label}
                  style={{ width: `${100 / featureColumns - 2}%`, padding: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                >
                  <View style={{ alignItems: 'center' }}>
                    <feature.Icon size={24} color={colors.accent} />
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginTop: 8, textAlign: 'center' }}>
                      {feature.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
                      {feature.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Tech Stack */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 12 }}>
              {t('builtWith') || 'Built with'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {techStack.map((tech) => (
                <View key={tech} style={{ backgroundColor: colors.muted, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{tech}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Version Info */}
          <View style={{ alignItems: 'center', marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 8 }}>
              CoFinance
            </Text>
            <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
              {versionInfo.displayVersion}
            </Text>
            {versionInfo.updateId && (
              <Text style={{ fontSize: 12, color: colors.mutedForeground + '99', marginTop: 4 }}>
                Update: {versionInfo.updateId.substring(0, 8)}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
