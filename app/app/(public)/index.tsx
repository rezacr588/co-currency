import { View, Text, Pressable, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeftRight, Wallet, Target, BarChart3 } from 'lucide-react-native';
import { useLanguage } from '../../src/context/LanguageContext';

export default function HomeScreen() {
  const { t } = useLanguage();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="p-6">
        {/* Hero Section */}
        <View className="items-center py-12">
          <Text className="text-4xl font-bold text-foreground mb-4">
            CoFinance
          </Text>
          <Text className="text-lg text-muted-foreground text-center mb-8">
            {t('heroSubtitle')}
          </Text>

          <View className="flex-row gap-4">
            <Link href="/login" asChild>
              <Pressable className="bg-primary px-6 py-3 rounded-xl">
                <Text className="text-white font-semibold">{t('login')}</Text>
              </Pressable>
            </Link>
            <Link href="/register" asChild>
              <Pressable className="bg-secondary px-6 py-3 rounded-xl">
                <Text className="text-foreground font-semibold">{t('register')}</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* Features Grid */}
        <View className="gap-4 mt-8">
          <Text className="text-2xl font-bold text-foreground mb-4">
            {t('features')}
          </Text>

          <View className="flex-row flex-wrap gap-4">
            <FeatureCard
              icon={<ArrowLeftRight size={32} color="rgb(212, 175, 55)" />}
              title={t('converterTitle')}
              description={t('converterDescription')}
            />
            <FeatureCard
              icon={<Wallet size={32} color="rgb(16, 185, 129)" />}
              title={t('wallet')}
              description={t('walletDescription')}
            />
            <FeatureCard
              icon={<Target size={32} color="rgb(59, 130, 246)" />}
              title={t('financialGoals')}
              description={t('goalsDescription')}
            />
            <FeatureCard
              icon={<BarChart3 size={32} color="rgb(168, 85, 247)" />}
              title={t('reportsAndStats')}
              description={t('reportsDescription')}
            />
          </View>
        </View>

        {/* CTA Section */}
        <View className="items-center py-12 mt-8">
          <Link href="/converter" asChild>
            <Pressable className="bg-accent px-8 py-4 rounded-xl">
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
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <View className="bg-card p-6 rounded-xl flex-1 min-w-[150px]">
      <View className="mb-4">{icon}</View>
      <Text className="text-lg font-semibold text-foreground mb-2">{title}</Text>
      <Text className="text-muted-foreground text-sm">{description}</Text>
    </View>
  );
}
