import { Container } from '../../layout';
import { useLanguage } from '../../../context/LanguageContext';

export function AboutUs() {
  const { t } = useLanguage();

  return (
    <div className="py-8 sm:py-12">
      <Container>
        {/* Compact Hero */}
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white mb-3">
              {t('aboutUs')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              {t('aboutUsDescription')}
            </p>
          </div>

          {/* Mission Banner - Compact */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-2xl p-6 mb-10 text-center">
            <p className="text-white text-lg font-medium">
              {t('missionDescription')}
            </p>
          </div>

          {/* Features Row - Compact */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { icon: '⚡', label: t('featureFast'), color: 'indigo' },
              { icon: '✓', label: t('featureAccurate'), color: 'emerald' },
              { icon: '🌍', label: t('featureGlobal'), color: 'purple' },
            ].map((feature) => (
              <div
                key={feature.label}
                className="text-center p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
              >
                <span className="text-2xl mb-2 block">{feature.icon}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {feature.label}
                </span>
              </div>
            ))}
          </div>

          {/* Founder Card - Modern & Compact */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-10">
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-5">
                {/* Profile Image */}
                <div className="relative flex-shrink-0">
                  <img
                    src="https://media.licdn.com/dms/image/v2/D4E03AQF3hRqdwxserA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1718006654218?e=1741219200&v=beta&t=5WdFxbGJfEfF2X5lqSwJXrwf3Fn6z7l5o5rZbKFGbhk"
                    alt="Reza Zeraat"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-indigo-100 dark:ring-indigo-900/50"
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                      Reza Zeraat
                    </h3>
                    <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full">
                      {t('coFounder')}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                    Full Stack Developer & ML Engineer
                  </p>

                  {/* Skills - Inline */}
                  <div className="flex flex-wrap gap-1.5">
                    {['React', 'TypeScript', 'Go', 'Python', 'ML'].map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* LinkedIn Button */}
                <a
                  href="https://www.linkedin.com/in/reza-zeraat-6628781b3/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#0077B5] hover:bg-[#006399] text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </a>
              </div>

              {/* Mobile LinkedIn */}
              <a
                href="https://www.linkedin.com/in/reza-zeraat-6628781b3/"
                target="_blank"
                rel="noopener noreferrer"
                className="sm:hidden flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-[#0077B5] hover:bg-[#006399] text-white rounded-lg transition-colors text-sm font-medium w-full"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                {t('viewLinkedIn')}
              </a>
            </div>
          </div>

          {/* App Features - New Section */}
          <div className="mb-10">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-6">
              {t('appFeatures')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: '💱', label: t('currencyConverter'), desc: t('converterDesc') },
                { icon: '💰', label: t('multiCurrencyWallet'), desc: t('walletDesc') },
                { icon: '🎯', label: t('financialGoals'), desc: t('goalsDesc') },
                { icon: '📊', label: t('budgets'), desc: t('budgetDesc') },
                { icon: '🔄', label: t('recurringTransactions'), desc: t('recurringDesc') },
                { icon: '📈', label: t('reportsAndStats'), desc: t('reportsDesc') },
                { icon: '🤖', label: t('aiReceiptParsing'), desc: t('aiParsingDesc') },
                { icon: '🌙', label: t('darkMode'), desc: t('darkModeDesc') },
                { icon: '🌐', label: t('multiLanguage'), desc: t('multiLangDesc') },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                >
                  <span className="text-2xl mb-2 block">{feature.icon}</span>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">
                    {feature.label}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Tech Stack - Minimal */}
          <div className="text-center">
            <p className="text-sm text-slate-500 dark:text-slate-500 mb-3">{t('builtWith')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['React', 'TypeScript', 'Go', 'PostgreSQL', 'Tailwind', 'Vite'].map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
