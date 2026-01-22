import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui';
import { HistoricalCard } from './HistoricalCard';
import { useCurrencies } from '../../../hooks';
import { useLanguage } from '../../../context/LanguageContext';

export function Historical() {
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('EUR');
  const { data: currencies } = useCurrencies();
  const { t } = useLanguage();

  const getDateDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  };

  const allDates = [
    getDateDaysAgo(1),
    getDateDaysAgo(7),
    getDateDaysAgo(30),
    getDateDaysAgo(90),
  ];

  // Validation: same currency selected
  const isSameCurrency = useMemo(() => baseCurrency === targetCurrency, [baseCurrency, targetCurrency]);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <CardTitle>{t('historicalRates')}</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-600/30 transition-all cursor-pointer w-24"
          >
            {currencies?.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
          <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <select
            value={targetCurrency}
            onChange={(e) => setTargetCurrency(e.target.value)}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-600/30 transition-all cursor-pointer w-24"
          >
            {currencies?.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {isSameCurrency ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-center text-sm">
            {t('sameCurrency')}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {allDates.map((date) => (
              <HistoricalCard
                key={date}
                date={date}
                baseCurrency={baseCurrency}
                targetCurrency={targetCurrency}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

