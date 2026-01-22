import { useLanguage } from '../../context/LanguageContext';

export function HowItWorksSection() {
  const { t } = useLanguage();

  const steps = [
    { number: '1', title: t('step1Title'), description: t('step1Desc'), icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
    { number: '2', title: t('step2Title'), description: t('step2Desc'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { number: '3', title: t('step3Title'), description: t('step3Desc'), icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  ];

  return (
    <section className="py-12">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
          {t('howItWorksTitle')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t('howItWorksSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, index) => (
          <div key={index} className="relative text-center">
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-[#1e3a5f] to-[#d4af37] dark:from-[#d4af37] dark:to-[#1e3a5f]" />
            )}

            {/* Step number */}
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2d4a6f] dark:from-[#d4af37] dark:to-[#c9a432] text-white dark:text-[#1e3a5f] text-2xl font-bold mb-6 shadow-lg">
              {step.number}
            </div>

            {/* Icon */}
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 mb-4">
              <svg className="w-6 h-6 text-[#1e3a5f] dark:text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
              </svg>
            </div>

            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              {step.title}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
