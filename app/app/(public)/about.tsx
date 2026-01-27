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
import { LinkedInIcon } from '../../src/constants/icons';
import { getVersionInfo } from '../../src/utils/version';

export default function AboutScreen() {
  const { t } = useLanguage();
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
    { Icon: RefreshCw, label: t('currencyConverter') || 'Currency Converter', desc: t('converterDesc') || '160+ currencies' },
    { Icon: Wallet, label: t('multiCurrencyWallet') || 'Multi-Currency Wallet', desc: t('walletDesc') || 'Track balances' },
    { Icon: Target, label: t('financialGoals') || 'Financial Goals', desc: t('goalsDesc') || 'Save smarter' },
    { Icon: PieChart, label: t('budgets') || 'Budgets', desc: t('budgetDesc') || 'Control spending' },
    { Icon: Repeat, label: t('recurringTransactions') || 'Recurring', desc: t('recurringDesc') || 'Automate finances' },
    { Icon: BarChart3, label: t('reportsAndStats') || 'Reports', desc: t('reportsDesc') || 'Track progress' },
    { Icon: Bot, label: t('aiReceiptParsing') || 'AI Parsing', desc: t('aiParsingDesc') || 'Smart receipts' },
    { Icon: Moon, label: t('darkMode') || 'Dark Mode', desc: t('darkModeDesc') || 'Easy on eyes' },
    { Icon: Languages, label: t('multiLanguage') || 'Multi-Language', desc: t('multiLangDesc') || '4 languages' },
  ];

  const techStack = ['React Native', 'Expo', 'TypeScript', 'Go', 'PostgreSQL', 'NativeWind'];

  const openLinkedIn = () => {
    Linking.openURL('https://www.linkedin.com/in/reza-zeraat-6628781b3/');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => router.back()}
            style={{ cursor: 'pointer' }}
            className="p-2 mr-2"
          >
            <ChevronLeft size={24} color="rgb(148, 163, 184)" />
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">
            {t('aboutUs') || 'About Us'}
          </Text>
        </View>

        <View style={{ maxWidth: isLargeScreen ? 800 : '100%', alignSelf: 'center', width: '100%' }}>
          {/* Description */}
          <Text className="text-muted-foreground text-center mb-6">
            {t('aboutUsDescription') || 'Your complete personal finance companion'}
          </Text>

          {/* Mission Banner */}
          <View className="bg-primary rounded-2xl p-6 mb-6">
            <Text className="text-primary-foreground text-center text-lg font-medium">
              {t('missionDescription') || 'Empowering you to take control of your finances across currencies and borders'}
            </Text>
          </View>

          {/* Quick Features */}
          <View className="flex-row justify-around mb-6">
            {quickFeatures.map((feature) => (
              <View key={feature.label} className="items-center p-4 bg-card rounded-xl border border-border flex-1 mx-1">
                <feature.Icon size={24} color="rgb(212, 175, 55)" />
                <Text className="text-sm font-medium text-foreground mt-2">{feature.label}</Text>
              </View>
            ))}
          </View>

          {/* Founder Card */}
          <View className="bg-card rounded-2xl border border-border p-6 mb-6">
            <View className={`${isLargeScreen ? 'flex-row items-center' : ''}`}>
              {/* Profile Image */}
              <View className={`${isLargeScreen ? 'mr-5' : 'items-center mb-4'}`}>
                <Image
                  source={{ uri: 'https://media.licdn.com/dms/image/v2/D4E03AQF3hRqdwxserA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1718006654218?e=1741219200&v=beta&t=5WdFxbGJfEfF2X5lqSwJXrwf3Fn6z7l5o5rZbKFGbhk' }}
                  className="w-24 h-24 rounded-full"
                  style={{ borderWidth: 4, borderColor: 'rgba(212, 175, 55, 0.3)' }}
                />
              </View>

              {/* Info */}
              <View className={`flex-1 ${isLargeScreen ? '' : 'items-center'}`}>
                <View className={`flex-row items-center gap-2 mb-1 ${isLargeScreen ? '' : 'justify-center'}`}>
                  <Text className="text-xl font-bold text-foreground">Reza Zeraat</Text>
                  <View className="bg-primary/20 px-2 py-0.5 rounded-full">
                    <Text className="text-xs font-semibold text-primary">
                      {t('coFounder') || 'Founder'}
                    </Text>
                  </View>
                </View>
                <Text className="text-muted-foreground text-sm mb-3">
                  Full Stack Developer & ML Engineer
                </Text>

                {/* Skills */}
                <View className="flex-row flex-wrap gap-1 mb-4">
                  {['React', 'TypeScript', 'Go', 'Python', 'ML'].map((skill) => (
                    <View key={skill} className="bg-muted px-2 py-0.5 rounded">
                      <Text className="text-xs text-muted-foreground">{skill}</Text>
                    </View>
                  ))}
                </View>

                {/* LinkedIn Button */}
                <Pressable
                  onPress={openLinkedIn}
                  style={{ cursor: 'pointer' }}
                  className="bg-[#0077B5] px-4 py-2 rounded-lg flex-row items-center justify-center"
                >
                  <LinkedInIcon size={16} color="white" />
                  <Text className="text-white font-medium ml-2">
                    {t('viewLinkedIn') || 'View LinkedIn'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* App Features */}
          <View className="mb-6">
            <Text className="text-xl font-bold text-foreground text-center mb-4">
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
                  style={{ width: `${100 / featureColumns - 2}%` }}
                  className="p-4 bg-card rounded-xl border border-border"
                >
                  <View className="items-center">
                    <feature.Icon size={24} color="rgb(212, 175, 55)" />
                    <Text className="text-sm font-semibold text-foreground mt-2 text-center">
                      {feature.label}
                    </Text>
                    <Text className="text-xs text-muted-foreground text-center mt-1">
                      {feature.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Tech Stack */}
          <View className="items-center">
            <Text className="text-sm text-muted-foreground mb-3">
              {t('builtWith') || 'Built with'}
            </Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              {techStack.map((tech) => (
                <View key={tech} className="bg-muted px-3 py-1.5 rounded-lg">
                  <Text className="text-sm text-muted-foreground">{tech}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Version Info */}
          <View className="items-center mt-8 pt-6 border-t border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">
              CoFinance
            </Text>
            <Text className="text-sm text-muted-foreground">
              {versionInfo.displayVersion}
            </Text>
            {versionInfo.updateId && (
              <Text className="text-xs text-muted-foreground/60 mt-1">
                Update: {versionInfo.updateId.substring(0, 8)}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
