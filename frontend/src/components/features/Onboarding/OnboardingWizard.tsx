import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '../../layout';
import { Button, Card } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';
import { WelcomeStep } from './WelcomeStep';
import { CurrencySetup } from './CurrencySetup';
import { FirstTransaction } from './FirstTransaction';

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'currency' | 'transaction' | 'complete';

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');

  const steps: Step[] = ['welcome', 'currency', 'transaction', 'complete'];
  const currentIndex = steps.indexOf(step);

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const handleComplete = () => {
    onComplete();
    navigate('/wallet');
  };

  const handleSkip = () => {
    onComplete();
    navigate('/wallet');
  };

  return (
    <main className="flex-1 py-8">
      <Container>
        <div className="max-w-2xl mx-auto">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      i <= currentIndex
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-16 sm:w-24 h-1 mx-2 transition-colors ${
                        i < currentIndex
                          ? 'bg-indigo-600'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <Card>
            {step === 'welcome' && (
              <WelcomeStep onNext={handleNext} onSkip={handleSkip} />
            )}

            {step === 'currency' && (
              <CurrencySetup
                selectedCurrency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}

            {step === 'transaction' && (
              <FirstTransaction
                currency={selectedCurrency}
                onNext={handleNext}
                onBack={handleBack}
                onSkip={handleNext}
              />
            )}

            {step === 'complete' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {t('setupComplete') || "You're All Set!"}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8">
                  {t('setupCompleteDesc') || 'Your wallet is ready. Start tracking your finances!'}
                </p>
                <Button variant="primary" onClick={handleComplete}>
                  {t('goToWallet') || 'Go to Wallet'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </Container>
    </main>
  );
}
