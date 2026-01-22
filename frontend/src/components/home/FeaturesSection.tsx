import { useLanguage } from '../../context/LanguageContext';
import { Card, CardContent } from '../ui/Card';

export function FeaturesSection() {
  const { t } = useLanguage();

  const features = [
    {
      title: t('featureWalletTitle'),
      description: t('featureWalletDesc'),
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      color: 'bg-blue-500',
    },
    {
      title: t('featureGoalsTitle'),
      description: t('featureGoalsDesc'),
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-green-500',
    },
    {
      title: t('featureBudgetsTitle'),
      description: t('featureBudgetsDesc'),
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'bg-purple-500',
    },
    {
      title: t('featureRecurringTitle'),
      description: t('featureRecurringDesc'),
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
      color: 'bg-orange-500',
    },
    {
      title: t('featureReportsTitle'),
      description: t('featureReportsDesc'),
      icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'bg-cyan-500',
    },
    {
      title: t('featureAITitle'),
      description: t('featureAIDesc'),
      icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      color: 'bg-pink-500',
    },
  ];

  return (
    <section className="py-12">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
          {t('featuresTitle')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          {t('featuresSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.color} mb-4 group-hover:scale-110 transition-transform`}>
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
