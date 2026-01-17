import { Button } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">👋</span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        {t('welcomeTitle') || `Welcome, ${user?.name || 'there'}!`}
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
        {t('welcomeDesc') ||
          "Let's set up your wallet in just a few steps. You'll be tracking your finances in no time!"}
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 text-left max-w-sm mx-auto">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-xl">💱</span>
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-white">
              {t('featureMultiCurrency') || 'Multi-Currency Support'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Track balances in 160+ currencies
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 text-left max-w-sm mx-auto">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-xl">📊</span>
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-white">
              {t('featureAnalytics') || 'Smart Analytics'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Visualize your spending patterns
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 text-left max-w-sm mx-auto">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-white">
              {t('featureAI') || 'AI Receipt Parsing'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Automatically extract transaction data
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <Button variant="secondary" onClick={onSkip}>
          {t('skip') || 'Skip'}
        </Button>
        <Button variant="primary" onClick={onNext}>
          {t('getStarted') || "Let's Get Started"}
        </Button>
      </div>
    </div>
  );
}
