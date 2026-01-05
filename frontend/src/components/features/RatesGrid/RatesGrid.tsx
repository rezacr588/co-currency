import { useState } from 'react';
import { useRates, useCurrencies } from '../../../hooks';
import { Card, CardContent, CardHeader, CardTitle, SkeletonRateCard } from '../../ui';
import { RateCard } from './RateCard';
import { POPULAR_CURRENCIES } from '../../../utils/constants';
import { formatTime } from '../../../utils/format';
import { useLanguage } from '../../../context/LanguageContext';

export function RatesGrid() {
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [showAll, setShowAll] = useState(false);
  const { t } = useLanguage();

  const { data: currencies } = useCurrencies();
  const { data: rates, isLoading, error, dataUpdatedAt } = useRates(baseCurrency);

  const displayedRates = showAll
    ? rates?.rates ?? []
    : rates?.rates?.filter((r) => POPULAR_CURRENCIES.includes(r.code)) ?? [];

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <CardTitle>{t('exchangeRates')}</CardTitle>
          {dataUpdatedAt && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t('updatedAt')} {formatTime(new Date(dataUpdatedAt).toISOString())}
            </p>
          )}
        </div>
        <select
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all cursor-pointer w-full sm:w-32"
        >
          {currencies?.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <p className="text-red-500 dark:text-red-400">{t('failedToLoadRates')}</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRateCard key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayedRates?.map((rate) => (
                <RateCard key={rate.code} rate={rate} baseCurrency={baseCurrency} />
              ))}
            </div>
            {rates && rates.rates.length > POPULAR_CURRENCIES.length && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-6 w-full py-3 px-6 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium text-sm transition-all duration-200"
              >
                {showAll ? t('showLess') : `${t('showAll')} (${rates.rates.length} ${t('currencies')})`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
