import { useAuth } from '../context/AuthContext';
import { Container } from '../components/layout';
import { Converter } from '../components/features/Converter';
import { RatesGrid } from '../components/features/RatesGrid';
import { QuickConvert } from '../components/features/QuickConvert';
import { Historical } from '../components/features/Historical';
import {
  HeroSection,
  StatsSection,
  FeaturesSection,
  HowItWorksSection,
  TrustSection,
  FinalCTA
} from '../components/home';

export function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        {/* Marketing sections for non-authenticated users */}
        {!isAuthenticated && (
          <div className="space-y-4">
            {/* Hero Section */}
            <HeroSection />

            {/* Stats Section */}
            <StatsSection />

            {/* Features Section */}
            <FeaturesSection />

            {/* How It Works Section */}
            <HowItWorksSection />

            {/* Trust Indicators Section */}
            <TrustSection />
          </div>
        )}

        {/* Converter Section - with anchor for navigation */}
        <div id="converter" className={!isAuthenticated ? 'pt-8' : ''}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Main Converter - Centered and prominent */}
            <section className="lg:col-span-7 xl:col-span-6 xl:col-start-1">
              <Converter />
            </section>

            {/* Quick Conversions - Side panel on large screens */}
            <section className="lg:col-span-5 xl:col-span-6">
              <QuickConvert />
            </section>

            {/* Exchange Rates Grid - Full width */}
            <section className="lg:col-span-12">
              <RatesGrid />
            </section>

            {/* Historical Rates - Full width */}
            <section className="lg:col-span-12">
              <Historical />
            </section>
          </div>
        </div>

        {/* Final CTA for non-authenticated users */}
        {!isAuthenticated && <FinalCTA />}
      </Container>
    </main>
  );
}
