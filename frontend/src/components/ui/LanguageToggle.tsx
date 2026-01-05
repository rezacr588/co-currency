import { useLanguage } from '../../context/LanguageContext';

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex items-center gap-2" role="group" aria-label={t('language')}>
      <button
        onClick={() => setLanguage('en')}
        className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 ${
          language === 'en'
            ? 'bg-primary-600 text-white'
            : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
        }`}
        aria-pressed={language === 'en'}
        aria-label="Switch to English"
      >
        {t('english')}
      </button>
      <button
        onClick={() => setLanguage('fa')}
        className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 ${
          language === 'fa'
            ? 'bg-primary-600 text-white'
            : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
        }`}
        aria-pressed={language === 'fa'}
        aria-label="تغییر به فارسی"
      >
        {t('persian')}
      </button>
    </div>
  );
}
