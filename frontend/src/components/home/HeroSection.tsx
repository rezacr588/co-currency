import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../ui/Button';

export function HeroSection() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-primary-800 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-2xl border border-primary-700/50 dark:border-slate-700/50">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 dark:bg-amber-400/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 dark:bg-amber-400/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative px-6 py-16 sm:py-20 md:py-24 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 text-white/90 text-sm font-medium backdrop-blur-sm">
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{t('statsFreeLabel')}</span>
          </div>

          {/* Main headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            {t('heroTitle')}
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-white/80 dark:text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('heroSubtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12 px-4 sm:px-0">
            <Link to="/register" className="w-full sm:w-auto">
              <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 dark:bg-amber-500 dark:hover:bg-amber-400 text-slate-900 font-semibold px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg shadow-lg shadow-amber-500/25 border-0"
              >
                {t('heroCtaPrimary')}
                <svg className="w-5 h-5 ms-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Button>
            </Link>
            <a href="#converter" className="w-full sm:w-auto">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/10 text-white border-white/30 dark:border-white/20 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg backdrop-blur-sm"
              >
                {t('heroCtaSecondary')}
              </Button>
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6 text-white/60 dark:text-slate-400 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t('trustSecure')}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t('trustPrivacy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t('trustOpen')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
