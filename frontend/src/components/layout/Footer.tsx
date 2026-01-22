import { useLanguage } from '../../context/LanguageContext';
import { Container } from './Container';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="py-4 mt-auto border-t border-slate-200/50 dark:border-slate-800/50">
      <Container>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          {t('footerText')}{' '}
          <a
            href="https://www.frankfurter.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            Frankfurter API
          </a>
          {' · '}{t('ratesUpdatedDaily')}
        </p>
      </Container>
    </footer>
  );
}
