import { useLanguage } from '../../context/LanguageContext';
import { Card, CardContent } from '../ui/Card';

export function StatsSection() {
  const { t } = useLanguage();

  const stats = [
    { value: t('statsCurrencies'), label: t('statsCurrenciesLabel'), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { value: t('statsRealTime'), label: t('statsRealTimeLabel'), icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { value: t('statsFree'), label: t('statsFreeLabel'), icon: 'M5 13l4 4L19 7' },
    { value: t('statsLanguages'), label: t('statsLanguagesLabel'), icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
  ];

  return (
    <section className="py-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1e3a5f]/10 dark:bg-[#d4af37]/10 mb-4">
                <svg className="w-6 h-6 text-[#1e3a5f] dark:text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                </svg>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] dark:text-[#d4af37] mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
