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
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-base">{t('exchangeRates')}</CardTitle>
          {dataUpdatedAt && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              {t('updatedAt')} {formatTime(new Date(dataUpdatedAt).toISOString())}
            </p>
          )}
        </div>
        <select
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          className="flex-shrink-0 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-600/30 transition-all cursor-pointer w-20"
        >
          {currencies?.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent className="pt-0">
        {error ? (
          <div className="text-center py-6">
            <p className="text-red-500 dark:text-red-400 text-sm">{t('failedToLoadRates')}</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonRateCard key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {displayedRates?.map((rate) => (
                <RateCard key={rate.code} rate={rate} baseCurrency={baseCurrency} />
              ))}
            </div>
            {rates && rates.rates.length > POPULAR_CURRENCIES.length && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-4 w-full py-2 px-4 rounded-lg bg-slate-100 dark:bg-slate-800/60 hover:bg-primary-50 dark:hover:bg-primary-600/10 text-primary-700 dark:text-primary-500 font-medium text-sm transition-colors"
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
