import { useLanguage } from '../../context/LanguageContext';

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  const languages = [
    { code: 'en', label: t('english') },
    { code: 'fa', label: t('persian') },
    { code: 'ar', label: t('arabic') },
    { code: 'tr', label: t('turkish') },
  ] as const;

  return (
    <div className="flex items-center gap-2" role="group" aria-label={t('language')}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 ${
            language === lang.code
              ? 'bg-primary-600 text-white'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
          }`}
          aria-pressed={language === lang.code}
          aria-label={lang.label}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
