import { Pressable, Text, View, useWindowDimensions, type DimensionValue } from 'react-native';
import { Link } from 'expo-router';
import { ArrowLeftRight, BarChart3, Target, Wallet } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../src/context/LanguageContext';
import { MarketingScaffold, SectionBlock, SurfaceCard } from '../../src/components/ui';

function CTAButton({
  href,
  label,
  primary = false,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  const theme = useTheme();

  return (
    <Link href={href as any} asChild>
      <Pressable
        style={({ pressed }) => [
          {
            minHeight: 48,
            borderRadius: theme.radii.md,
            borderWidth: primary ? 0 : 1,
            borderColor: primary ? 'transparent' : theme.colors.border,
            backgroundColor: primary ? theme.colors.primary : theme.colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 20,
          },
          primary ? theme.shadows.sm : null,
          pressed && { opacity: 0.72 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={{
            color: primary ? theme.colors.primaryForeground : theme.colors.foreground,
            fontFamily: theme.typography.bodyMedium.fontFamily,
            fontSize: 15,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

function HeroStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const theme = useTheme();

  return (
    <View style={{ minWidth: 120 }}>
      <Text
        style={{
          fontSize: 24,
          lineHeight: 32,
          fontFamily: theme.typography.h1.fontFamily,
          color: theme.colors.foreground,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: theme.typography.caption.fontSize,
          lineHeight: theme.typography.caption.lineHeight,
          color: theme.colors.mutedForeground,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  width,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  width?: DimensionValue;
}) {
  const theme = useTheme();

  return (
    <SurfaceCard style={{ width, flexGrow: 1 }}>
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
          fontSize: 18,
          lineHeight: 24,
          fontFamily: theme.typography.h2.fontFamily,
          color: theme.colors.foreground,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: theme.spacing.sm,
          fontSize: theme.typography.body.fontSize,
          lineHeight: theme.typography.body.lineHeight,
          color: theme.colors.mutedForeground,
        }}
      >
        {description}
      </Text>
    </SurfaceCard>
  );
}

export default function HomeScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const featureWidth = isDesktop ? '23%' : isTablet ? '48%' : '100%';
  const heroTitleSize = isDesktop ? 48 : 32;
  const heroLineHeight = isDesktop ? 56 : 40;

  return (
    <MarketingScaffold>
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: theme.spacing.xxxl,
          alignItems: 'stretch',
          marginBottom: theme.spacing.xxxl,
        }}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: heroTitleSize,
              lineHeight: heroLineHeight,
              fontFamily: theme.typography.h1.fontFamily,
              color: theme.colors.foreground,
              letterSpacing: -1,
            }}
          >
            CoAI
          </Text>
          <Text
            style={{
              marginTop: theme.spacing.lg,
              maxWidth: 580,
              fontSize: 15,
              lineHeight: 22,
              color: theme.colors.mutedForeground,
            }}
          >
            {t('heroSubtitle')}
          </Text>

          <View
            style={{
              flexDirection: isTablet ? 'row' : 'column',
              gap: theme.spacing.md,
              marginTop: theme.spacing.xxl,
              alignItems: isTablet ? 'center' : 'stretch',
            }}
          >
            <CTAButton href="/register" label={t('register')} primary />
            <CTAButton href="/converter" label={t('tryConverter')} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.xl,
              marginTop: theme.spacing.xxxl,
            }}
          >
            <HeroStat value="160+" label={t('converterTitle')} />
            <HeroStat value="24/7" label={t('reportsAndStats')} />
            <HeroStat value="4" label={t('multiLanguage') || 'Languages'} />
          </View>
        </View>

        <SurfaceCard variant="elevated" style={{ flex: isDesktop ? 0.9 : undefined, padding: 20 }}>
          <Text
            style={{
              fontSize: 18,
              lineHeight: 24,
              fontFamily: theme.typography.h2.fontFamily,
              color: theme.colors.foreground,
              marginBottom: theme.spacing.lg,
            }}
          >
            {t('reportsAndStats')}
          </Text>

          <View style={{ gap: theme.spacing.md }}>
            {[
              {
                label: t('wallet'),
                value: '$42,380',
                note: t('walletDescription') || 'Track balances across currencies',
              },
              {
                label: t('financialGoals'),
                value: '78%',
                note: t('goalsDescription') || 'Stay on pace with savings targets',
              },
              {
                label: t('reports'),
                value: '12',
                note: t('reportsDescription') || 'Review cash flow and spending trends',
              },
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.backgroundSecondary,
                  padding: theme.spacing.lg,
                }}
              >
                <Text style={{ color: theme.colors.mutedForeground, fontSize: 12, lineHeight: 16 }}>{item.label}</Text>
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 24,
                    lineHeight: 32,
                    fontFamily: theme.typography.h1.fontFamily,
                    color: theme.colors.foreground,
                  }}
                >
                  {item.value}
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.colors.mutedForeground,
                  }}
                >
                  {item.note}
                </Text>
              </View>
            ))}
          </View>
        </SurfaceCard>
      </View>

      <SectionBlock
        title={t('features')}
        subtitle={t('aboutUsDescription') || 'A standard personal finance workflow across mobile and web.'}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          <FeatureCard
            icon={<ArrowLeftRight size={22} color={theme.colors.primary} />}
            title={t('converterTitle')}
            description={t('converterDescription')}
            width={featureWidth}
          />
          <FeatureCard
            icon={<Wallet size={22} color={theme.colors.primary} />}
            title={t('wallet')}
            description={t('walletDescription')}
            width={featureWidth}
          />
          <FeatureCard
            icon={<Target size={22} color={theme.colors.primary} />}
            title={t('financialGoals')}
            description={t('goalsDescription')}
            width={featureWidth}
          />
          <FeatureCard
            icon={<BarChart3 size={22} color={theme.colors.primary} />}
            title={t('reportsAndStats')}
            description={t('reportsDescription')}
            width={featureWidth}
          />
        </View>
      </SectionBlock>

      <SectionBlock
        title={t('appFeatures') || 'App Features'}
        subtitle={t('missionDescription') || 'Manage balances, conversion, planning, and reporting from one account.'}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          <SurfaceCard style={{ width: isDesktop ? '32%' : '100%' }}>
            <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.h2.fontFamily, fontSize: 18, lineHeight: 24 }}>
              {t('wallet')}
            </Text>
            <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
              {t('walletDescription') || 'See balances, recent transactions, and quick actions in one standard dashboard.'}
            </Text>
          </SurfaceCard>
          <SurfaceCard style={{ width: isDesktop ? '32%' : '100%' }}>
            <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.h2.fontFamily, fontSize: 18, lineHeight: 24 }}>
              {t('reports')}
            </Text>
            <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
              {t('reportsDescription') || 'Compare periods, monitor net worth, and drill into categories without leaving the main flow.'}
            </Text>
          </SurfaceCard>
          <SurfaceCard style={{ width: isDesktop ? '32%' : '100%' }}>
            <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.h2.fontFamily, fontSize: 18, lineHeight: 24 }}>
              {t('financialGoals')}
            </Text>
            <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
              {t('goalsDescription') || 'Create goals, contribute toward them, and keep progress visible across devices.'}
            </Text>
          </SurfaceCard>
        </View>
      </SectionBlock>

      <SurfaceCard
        style={{
          marginBottom: theme.spacing.xxxl,
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        }}
      >
        <View style={{ flexDirection: isTablet ? 'row' : 'column', alignItems: isTablet ? 'center' : 'flex-start', justifyContent: 'space-between', gap: theme.spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 24,
                lineHeight: 32,
                fontFamily: theme.typography.h1.fontFamily,
                color: theme.colors.primaryForeground,
              }}
            >
              {t('getStarted') || 'Get Started'}
            </Text>
            <Text
              style={{
                marginTop: theme.spacing.sm,
                color: theme.colors.primaryForeground,
                opacity: 0.85,
                fontSize: 15,
                lineHeight: 22,
              }}
            >
              {t('registerSubtitle') || 'Create an account and keep your core finance workflow consistent on mobile and web.'}
            </Text>
          </View>
          <CTAButton href="/register" label={t('register')} />
        </View>
      </SurfaceCard>
    </MarketingScaffold>
  );
}
