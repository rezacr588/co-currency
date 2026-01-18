import { Link } from 'react-router-dom';
import { Container } from '../../layout';
import { useLanguage } from '../../../context/LanguageContext';

export function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <Container>
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-2xl shadow-xl shadow-primary-600/30 overflow-hidden">
            <img src="/logo.svg" alt="CoFinance Logo" className="w-full h-full" loading="eager" />
          </div>

          <h1 className="text-6xl sm:text-8xl font-bold text-primary-700 dark:text-primary-500 mb-4">
            404
          </h1>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white mb-4">
            {t('pageNotFound')}
          </h2>

          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
            {t('pageNotFoundDesc')}
          </p>

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-medium shadow-lg shadow-primary-600/25 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {t('backToHome')}
          </Link>
        </div>
      </Container>
    </div>
  );
}
