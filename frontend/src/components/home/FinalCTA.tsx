import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { ROUTES } from '../../constants/routes';

export function FinalCTA() {
  const { t } = useLanguage();

  return (
    <section className="py-12">
      <Card className="overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-primary-800 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 border-primary-700/50 dark:border-slate-600/50">
        <CardContent className="py-12 px-6 text-center relative">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/20 dark:bg-amber-400/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-amber-500/20 dark:bg-amber-400/10 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              {t('finalCtaTitle')}
            </h2>
            <p className="text-white/80 dark:text-slate-300 mb-8 text-lg">
              {t('finalCtaSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to={ROUTES.register}>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-4 text-lg shadow-lg shadow-amber-500/25 border-0"
                >
                  {t('heroCtaPrimary')}
                  <svg className="w-5 h-5 ms-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
              </Link>
              <Link to={ROUTES.login}>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto bg-white/10 hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/10 text-white border-white/30 dark:border-white/20 px-8 py-4 text-lg backdrop-blur-sm"
                >
                  {t('login')}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
