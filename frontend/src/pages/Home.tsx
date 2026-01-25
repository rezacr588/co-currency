import { Navigate } from 'react-router-dom';
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
import { ROUTES } from '../constants/routes';

export function Home() {
  const { isAuthenticated } = useAuth();

  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="space-y-4">
          {/* Hero Section */}
          <HeroSection />

          {/* Stats Section */}
          <StatsSection />

          {/* Converter Preview for Public Users */}
          <div id="converter" className="pt-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
              <section className="lg:col-span-7 xl:col-span-6 xl:col-start-1">
                <Converter />
              </section>
              <section className="lg:col-span-5 xl:col-span-6">
                <QuickConvert />
              </section>
              <section className="lg:col-span-12">
                <RatesGrid />
              </section>
              <section className="lg:col-span-12">
                <Historical />
              </section>
            </div>
          </div>

          {/* Features Section */}
          <FeaturesSection />

          {/* How It Works Section */}
          <HowItWorksSection />

          {/* Trust Indicators Section */}
          <TrustSection />

          {/* Final CTA */}
          <FinalCTA />
        </div>
      </Container>
    </main>
  );
}
