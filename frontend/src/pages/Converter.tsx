import { Container } from '../components/layout';
import { Converter as ConverterWidget } from '../components/features/Converter';
import { RatesGrid } from '../components/features/RatesGrid';
import { QuickConvert } from '../components/features/QuickConvert';
import { Historical } from '../components/features/Historical';

export function Converter() {
  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Main Converter - Centered and prominent */}
          <section className="lg:col-span-7 xl:col-span-6 xl:col-start-1">
            <ConverterWidget />
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
      </Container>
    </main>
  );
}
