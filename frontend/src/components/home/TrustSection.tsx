import { useLanguage } from '../../context/LanguageContext';
import { Card, CardContent } from '../ui/Card';

export function TrustSection() {
  const { t } = useLanguage();

  const trustItems = [
    { title: t('trustSecure'), description: t('trustSecureDesc'), icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { title: t('trustPrivacy'), description: t('trustPrivacyDesc'), icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { title: t('trustOpen'), description: t('trustOpenDesc'), icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  return (
    <section className="py-12">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
          {t('trustTitle')}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {trustItems.map((item, index) => (
          <Card key={index} className="border-2 border-[#1e3a5f]/10 dark:border-[#d4af37]/20 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1e3a5f]/10 dark:bg-[#d4af37]/10 mb-4">
                <svg className="w-7 h-7 text-[#1e3a5f] dark:text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {item.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
