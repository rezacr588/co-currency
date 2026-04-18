import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import {
  ArrowLeftRight, BarChart3, Bot, CheckCircle, ChevronDown, ChevronUp,
  Globe, Lock, Monitor, PieChart, Shield, Smartphone, Sparkles, Target, Wallet, Zap,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../src/context/LanguageContext';
import { MarketingScaffold, SectionBlock, SurfaceCard } from '../../src/components/ui';
import { SEOHead } from '../../src/components/seo';

function CTAButton({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  const theme = useTheme();
  return (
    <Link href={href as any} asChild>
      <Pressable
        style={({ pressed }) => [
          {
            minHeight: 52,
            borderRadius: theme.radii.md,
            borderWidth: primary ? 0 : 1,
            borderColor: primary ? 'transparent' : theme.colors.border,
            backgroundColor: primary ? theme.colors.primary : theme.colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
          },
          primary ? theme.shadows.md : null,
          pressed && { opacity: 0.72 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={{ color: primary ? theme.colors.primaryForeground : theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily, fontSize: 16 }}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon}
      <Text style={{ fontSize: 12, color: theme.colors.mutedForeground, fontFamily: theme.typography.caption.fontFamily }}>{label}</Text>
    </View>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1, minWidth: 100 }}>
      <Text style={{ fontSize: 28, fontFamily: theme.typography.h1.fontFamily, color: theme.colors.foreground }}>{value}</Text>
      <Text style={{ fontSize: 12, color: theme.colors.mutedForeground, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  const theme = useTheme();
  return (
    <SurfaceCard>
      <View style={{ width: 44, height: 44, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md }}>
        {icon}
      </View>
      <Text style={{ fontSize: 17, fontFamily: theme.typography.h2.fontFamily, color: theme.colors.foreground }}>{title}</Text>
      <Text style={{ marginTop: theme.spacing.sm, fontSize: 14, lineHeight: 20, color: theme.colors.mutedForeground }}>{description}</Text>
    </SurfaceCard>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 240 }}>
      <View style={{ width: 36, height: 36, borderRadius: 9999, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md }}>
        <Text style={{ color: theme.colors.primaryForeground, fontFamily: theme.typography.h2.fontFamily, fontSize: 16 }}>{number}</Text>
      </View>
      <Text style={{ fontSize: 17, fontFamily: theme.typography.h2.fontFamily, color: theme.colors.foreground }}>{title}</Text>
      <Text style={{ marginTop: theme.spacing.sm, fontSize: 14, lineHeight: 20, color: theme.colors.mutedForeground }}>{description}</Text>
    </View>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => setOpen(!open)}
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radii.md,
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.card,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 15, fontFamily: theme.typography.bodyMedium.fontFamily, color: theme.colors.foreground, flex: 1, marginEnd: 8 }}>{question}</Text>
        {open ? <ChevronUp size={18} color={theme.colors.mutedForeground} /> : <ChevronDown size={18} color={theme.colors.mutedForeground} />}
      </View>
      {open && (
        <Text style={{ marginTop: theme.spacing.md, fontSize: 14, lineHeight: 20, color: theme.colors.mutedForeground }}>{answer}</Text>
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  const faqData = [
    { q: t('landingFaqQ1') || 'Is CoAI really free?', a: t('landingFaqA1') || 'Yes. No premium tier, no ads, no hidden costs. Every feature is free.' },
    { q: t('landingFaqQ2') || 'How does CoAI work?', a: t('landingFaqA2') || 'CoAI reads your financial context and turns it into priorities, alerts, and guided actions. It can also parse receipts and answer questions.' },
    { q: t('landingFaqQ3') || 'What currencies are supported?', a: t('landingFaqA3') || '160+ currencies with real-time exchange rates from the European Central Bank. Updated 24/7.' },
    { q: t('landingFaqQ4') || 'Is my data safe?', a: t('landingFaqA4') || 'Absolutely. Bank-level encryption, JWT authentication, and we never share your data with third parties.' },
    { q: t('landingFaqQ5') || 'Does it work offline?', a: t('landingFaqA5') || 'Yes. Your transactions are saved locally and sync automatically when you reconnect.' },
    { q: t('landingFaqQ6') || 'What platforms are supported?', a: t('landingFaqA6') || 'Web, iOS, and Android. One account works across all your devices.' },
  ];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <MarketingScaffold>
      <SEOHead
        title={t('landingHeroTitle') || 'CoAI is your personal finance copilot'}
        description={t('seoHomeDescription') || 'CoAI helps you understand your money, track across currencies, and take guided action on budgets, goals, and spending.'}
        canonicalPath="/"
        ogImageAlt="CoAI personal finance copilot"
        keywords={[
          'coai',
          'personal finance copilot',
          'ai finance assistant',
          'multi-currency wallet',
          'budget tracker',
          'savings goals',
        ]}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'CoAI Home',
            url: 'https://coai.koyeb.app/',
            description:
              'CoAI helps you understand your money, track across currencies, and take guided action on budgets, goals, and spending.',
          },
          faqJsonLd,
        ]}
      />

      {/* ── Section 1: Hero ── */}
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: theme.spacing.xxxl, alignItems: 'center', marginBottom: theme.spacing.xxxl * 1.5 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: isDesktop ? 48 : 32, lineHeight: isDesktop ? 56 : 40, fontFamily: theme.typography.h1.fontFamily, color: theme.colors.foreground, letterSpacing: -1 }}>
            {t('landingHeroTitle') || 'CoAI is your personal finance copilot.'}
          </Text>
          <Text style={{ marginTop: theme.spacing.lg, maxWidth: 540, fontSize: 16, lineHeight: 24, color: theme.colors.mutedForeground }}>
            {t('landingHeroSubtitle') || 'Ask CoAI what matters, understand your money across currencies, and take guided action on budgets, goals, and spending.'}
          </Text>
          <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: theme.spacing.md, marginTop: theme.spacing.xxl, alignItems: isTablet ? 'center' : 'stretch' }}>
            <CTAButton href="/register" label={t('landingHeroCta') || 'Take Control — It\'s Free'} primary />
            <CTAButton href="/converter" label={t('landingHeroSecondaryCta') || 'Try the Converter'} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xl, marginTop: theme.spacing.xxl }}>
            <TrustBadge icon={<Shield size={14} color={theme.colors.success} />} label={t('landingTrustFree') || 'Free Forever'} />
            <TrustBadge icon={<Globe size={14} color={theme.colors.info} />} label={t('landingTrustCurrencies') || '160+ Currencies'} />
            <TrustBadge icon={<Sparkles size={14} color={theme.colors.accent} />} label={t('landingTrustMemory') || 'AI with Memory'} />
            <TrustBadge icon={<Zap size={14} color={theme.colors.warning} />} label={t('landingTrustRates') || 'Real-Time Rates'} />
            <TrustBadge icon={<Lock size={14} color={theme.colors.mutedForeground} />} label={t('landingTrustPrivacy') || 'Privacy First'} />
          </View>
        </View>

        {isTablet && (
          <SurfaceCard variant="elevated" style={{ flex: isDesktop ? 0.85 : undefined, padding: theme.spacing.xl }}>
            <Text style={{ fontSize: 16, fontFamily: theme.typography.h2.fontFamily, color: theme.colors.foreground, marginBottom: theme.spacing.lg }}>
              {t('reportsAndStats') || 'CoAI Preview'}
            </Text>
            {[
              { label: 'CoAI brief', value: '3', note: 'Priorities surfaced from your latest financial data' },
              { label: t('financialGoals') || 'Goals', value: '78%', note: t('landingFeatureGoalsDesc') || 'Stay on pace with savings targets' },
              { label: t('reports') || 'Reports', value: '12', note: t('landingFeatureReportsDesc') || 'Cash flow and spending trends' },
            ].map((item) => (
              <View key={item.label} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, backgroundColor: theme.colors.backgroundSecondary, padding: theme.spacing.lg, marginBottom: theme.spacing.md }}>
                <Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>{item.label}</Text>
                <Text style={{ marginTop: 6, fontSize: 22, fontFamily: theme.typography.h1.fontFamily, color: theme.colors.foreground }}>{item.value}</Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: theme.colors.mutedForeground }}>{item.note}</Text>
              </View>
            ))}
          </SurfaceCard>
        )}
      </View>

      {/* ── Section 2: Stats Bar ── */}
      <SurfaceCard variant="glass" style={{ marginBottom: theme.spacing.xxxl * 1.5 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: theme.spacing.md }}>
          <StatCard value="160+" label={t('statsCurrenciesLabel') || 'Currencies'} />
          <StatCard value="24/7" label={t('statsRealTimeLabel') || 'Live Rates'} />
          <StatCard value="4" label={t('statsLanguagesLabel') || 'Languages'} />
          <StatCard value="$0" label={t('statsFreeLabel') || 'Forever Free'} />
        </View>
      </SurfaceCard>

      {/* ── Section 3: Features Grid ── */}
      <SectionBlock
        title={t('landingFeaturesTitle') || 'CoAI tells you what matters and helps you act.'}
        subtitle={t('featuresSubtitle') || 'Assistant-first personal finance with the supporting layers you still need.'}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {[
            { icon: <Wallet size={22} color={theme.colors.primary} />, title: t('featureWalletTitle') || 'Multi-Currency Wallet', desc: t('landingFeatureWalletDesc') || 'Know exactly what you have, in every currency, right now.' },
            { icon: <Bot size={22} color={theme.colors.primary} />, title: t('featureAITitle') || 'CoAI Copilot', desc: t('landingFeatureAIDesc') || 'Get priorities, alerts, and next actions grounded in your real financial context.' },
            { icon: <PieChart size={22} color={theme.colors.primary} />, title: t('featureBudgetsTitle') || 'Smart Budgets', desc: t('landingFeatureBudgetsDesc') || 'Know exactly what you can spend before you spend it.' },
            { icon: <Target size={22} color={theme.colors.primary} />, title: t('featureGoalsTitle') || 'Savings Goals', desc: t('landingFeatureGoalsDesc') || 'Set a target. Track progress. Hit it faster with AI.' },
            { icon: <BarChart3 size={22} color={theme.colors.primary} />, title: t('featureReportsTitle') || 'Reports & Analytics', desc: t('landingFeatureReportsDesc') || 'See your spending patterns. Spot the leaks.' },
            { icon: <Shield size={22} color={theme.colors.accent} />, title: t('landingFeatureRealValue') || 'Real Value Protection', desc: t('landingFeatureRealValueDesc') || 'See what your money actually buys, not what the number says.' },
          ].map((f) => (
            <View key={f.title} style={{ width: isDesktop ? '31%' : isTablet ? '48%' : '100%', flexGrow: 1 }}>
              <FeatureCard icon={f.icon} title={f.title} description={f.desc} />
            </View>
          ))}
        </View>
      </SectionBlock>

      {/* ── Section 4: How It Works ── */}
      <SectionBlock
        title={t('landingHowTitle') || 'Three steps to get CoAI working for you.'}
        subtitle={t('howItWorksSubtitle') || 'Set up the assistant, add context, and start acting on guidance.'}
      >
        <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: theme.spacing.xl }}>
          <StepCard number={1} title={t('step1Title') || 'Create your account'} description={t('landingStep1Desc') || '30 seconds. No credit card. No strings.'} />
          <StepCard number={2} title={t('step2Title') || 'Add your finances'} description={t('landingStep2Desc') || 'Import transactions, set budgets, pick your currencies.'} />
          <StepCard number={3} title={t('step3Title') || 'Get guidance'} description={t('landingStep3Desc') || 'CoAI explains what changed and helps you act on it.'} />
        </View>
      </SectionBlock>

      {/* ── Section 5: AI Showcase ── */}
      <SectionBlock
        title={t('landingAITitle') || 'An assistant that actually knows your finances'}
      >
        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: theme.spacing.xl, alignItems: 'stretch' }}>
          <SurfaceCard variant="elevated" style={{ flex: isDesktop ? 1.2 : undefined, padding: 20 }}>
            <View style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={{ width: 28, height: 28, borderRadius: 9999, backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12 }}>👤</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: theme.colors.secondary, borderRadius: theme.radii.md, padding: theme.spacing.md }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>{t('landingAIChatUser') || 'Where am I spending too much?'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={{ width: 28, height: 28, borderRadius: 9999, backgroundColor: theme.colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={14} color={theme.colors.accent} />
                </View>
                <View style={{ flex: 1, backgroundColor: theme.alpha(theme.colors.accent, 0.1), borderRadius: theme.radii.md, padding: theme.spacing.md }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 14, lineHeight: 20 }}>
                    {t('landingAIChatBot') || 'Your dining spend is 34% of this month’s outflow and trending above last month. Moving two meals a week home would save roughly $180/month. Want me to turn that into a food budget?'}
                  </Text>
                </View>
              </View>
            </View>
          </SurfaceCard>

          <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
            {[
              { icon: <ArrowLeftRight size={16} color={theme.colors.success} />, text: t('landingAIBullet1') || 'Reads receipts and invoices from photos' },
              { icon: <CheckCircle size={16} color={theme.colors.success} />, text: t('landingAIBullet2') || 'Remembers your financial history' },
              { icon: <Globe size={16} color={theme.colors.success} />, text: t('landingAIBullet3') || 'Speaks 4 languages' },
              { icon: <Zap size={16} color={theme.colors.success} />, text: t('landingAIBullet4') || 'Available 24/7 — never sleeps' },
            ].map((b) => (
              <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {b.icon}
                <Text style={{ fontSize: 14, color: theme.colors.foreground }}>{b.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </SectionBlock>

      {/* ── Section 6: Security & Trust ── */}
      <SectionBlock
        title={t('landingSecurityTitle') || 'Your money. Your data. Your rules.'}
        subtitle={t('landingSecurityDesc') || 'We don\'t sell data. We don\'t show ads.'}
      >
        <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: theme.spacing.md }}>
          {[
            { icon: <Lock size={22} color={theme.colors.primary} />, title: t('trustSecure') || 'Encrypted', desc: t('trustSecureDesc') || 'Industry-standard encryption protects every transaction.' },
            { icon: <Shield size={22} color={theme.colors.primary} />, title: t('trustPrivacy') || 'Private', desc: t('trustPrivacyDesc') || 'Your financial data is never sold or shared.' },
            { icon: <Zap size={22} color={theme.colors.primary} />, title: t('trustOpen') || 'No Ads', desc: t('trustOpenDesc') || 'Real-time rates from the ECB. No hidden fees, no ads.' },
          ].map((c) => (
            <SurfaceCard key={c.title} style={{ flex: 1 }}>
              <View style={{ width: 44, height: 44, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md }}>
                {c.icon}
              </View>
              <Text style={{ fontSize: 16, fontFamily: theme.typography.h2.fontFamily, color: theme.colors.foreground }}>{c.title}</Text>
              <Text style={{ marginTop: theme.spacing.sm, fontSize: 14, lineHeight: 20, color: theme.colors.mutedForeground }}>{c.desc}</Text>
            </SurfaceCard>
          ))}
        </View>
      </SectionBlock>

      {/* ── Section 7: FAQ ── */}
      <SectionBlock title={t('landingFaqTitle') || 'Questions? Answered.'}>
        <View style={{ gap: theme.spacing.md }}>
          {faqData.map((f) => (
            <FAQItem key={f.q} question={f.q} answer={f.a} />
          ))}
        </View>
      </SectionBlock>

      {/* ── Section 8: Multi-Platform ── */}
      <SectionBlock title={t('landingPlatformTitle') || 'Everywhere you are.'}>
        <View style={{ flexDirection: isTablet ? 'row' : 'column', justifyContent: 'center', alignItems: 'center', gap: theme.spacing.xl, paddingVertical: theme.spacing.xl }}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Smartphone size={28} color="#3ddc84" />
            <Text style={{ fontSize: 15, fontFamily: theme.typography.bodyMedium.fontFamily, color: theme.colors.foreground }}>Android</Text>
            <CTAButton href="/download" label={t('landingDownloadApp') || 'Download APK'} primary />
          </View>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Monitor size={28} color={theme.colors.foreground} />
            <Text style={{ fontSize: 15, fontFamily: theme.typography.bodyMedium.fontFamily, color: theme.colors.foreground }}>Web</Text>
            <CTAButton href="/login" label={t('landingOpenWebApp') || 'Open Web App'} />
          </View>
          <View style={{ alignItems: 'center', gap: 10, opacity: 0.5 }}>
            <Smartphone size={28} color={theme.colors.mutedForeground} />
            <Text style={{ fontSize: 15, fontFamily: theme.typography.bodyMedium.fontFamily, color: theme.colors.mutedForeground }}>iOS</Text>
            <Text style={{ fontSize: 12, color: theme.colors.mutedForeground }}>{t('downloadIOSComingSoon') || 'Coming soon'}</Text>
          </View>
        </View>
        <Text style={{ textAlign: 'center', fontSize: 14, color: theme.colors.mutedForeground, marginTop: theme.spacing.md }}>
          {t('landingPlatformDesc') || 'One account. Every device. Always in sync.'}
        </Text>
      </SectionBlock>

      {/* ── Section 9: Final CTA ── */}
      <SurfaceCard style={{ marginBottom: theme.spacing.xxxl, backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }}>
        <View style={{ flexDirection: isTablet ? 'row' : 'column', alignItems: isTablet ? 'center' : 'flex-start', justifyContent: 'space-between', gap: theme.spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, lineHeight: 32, fontFamily: theme.typography.h1.fontFamily, color: theme.colors.primaryForeground }}>
              {t('landingFinalTitle') || 'Take control of your money.'}
            </Text>
            <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.primaryForeground, opacity: 0.85, fontSize: 15, lineHeight: 22 }}>
              {t('landingFinalDesc') || 'Start free. No credit card. No commitment.'}
            </Text>
          </View>
          <CTAButton href="/register" label={t('landingFinalCta') || 'Get Started'} />
        </View>
      </SurfaceCard>
    </MarketingScaffold>
  );
}
