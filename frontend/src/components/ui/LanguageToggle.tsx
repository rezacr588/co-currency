import { useLanguage } from '../../context/LanguageContext';

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          language === 'en'
            ? 'bg-primary-600 text-white'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        {t('english')}
      </button>
      <button
        onClick={() => setLanguage('fa')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          language === 'fa'
            ? 'bg-primary-600 text-white'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        {t('persian')}
      </button>
    </div>
  );
}
