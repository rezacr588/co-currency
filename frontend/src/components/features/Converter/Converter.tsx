import { useState } from 'react';
import { useConvert, useCurrencies } from '../../../hooks';
import { AmountInput } from './AmountInput';
import { CurrencySelect } from './CurrencySelect';
import { SwapButton } from './SwapButton';
import { ResultDisplay } from './ResultDisplay';
import { useLanguage } from '../../../context/LanguageContext';

export function Converter() {
  const [amount, setAmount] = useState(1);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const { t } = useLanguage();

  const { data: currencies } = useCurrencies();
  const { data: result, isLoading, error } = useConvert(
    fromCurrency,
    toCurrency,
    amount
  );

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Glass Card Container */}
      <div className="relative overflow-hidden bg-slate-800/60 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl shadow-slate-900/50">
        {/* Gradient Background Decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/5 via-transparent to-accent-600/5" />

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-700/50">
          <h2 className="text-xl font-bold text-slate-100 text-center">{t('converterTitle')}</h2>
        </div>

        {/* Content */}
        <div className="relative p-6 space-y-5">
          {/* Amount Input */}
          <AmountInput value={amount} onChange={setAmount} />

          {/* Currency Selectors with Swap */}
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <CurrencySelect
                value={fromCurrency}
                onChange={setFromCurrency}
                currencies={currencies}
                label={t('from')}
              />
            </div>

            <div className="pb-6">
              <SwapButton onClick={handleSwap} />
            </div>

            <div className="flex-1 min-w-0">
              <CurrencySelect
                value={toCurrency}
                onChange={setToCurrency}
                currencies={currencies}
                label={t('to')}
              />
            </div>
          </div>

          {/* Result Display */}
          <ResultDisplay
            result={result}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
