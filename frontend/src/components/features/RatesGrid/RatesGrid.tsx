import { useState } from 'react';
import { useRates, useCurrencies } from '../../../hooks';
import { Card, CardContent, CardHeader, CardTitle, SkeletonRateCard } from '../../ui';
import { RateCard } from './RateCard';
import { POPULAR_CURRENCIES } from '../../../utils/constants';
import { formatTime } from '../../../utils/format';

export function RatesGrid() {
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [showAll, setShowAll] = useState(false);

  const { data: currencies } = useCurrencies();
  const { data: rates, isLoading, error, dataUpdatedAt } = useRates(baseCurrency);

  const displayedRates = showAll
    ? rates?.rates ?? []
    : rates?.rates?.filter((r) => POPULAR_CURRENCIES.includes(r.code)) ?? [];

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Exchange Rates</CardTitle>
          {dataUpdatedAt && (
            <p className="text-xs text-slate-400 mt-1">
              Updated at {formatTime(new Date(dataUpdatedAt).toISOString())}
            </p>
          )}
        </div>
        <select
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          className="select w-32"
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
          <div className="text-center text-red-400 py-8">
            Failed to load rates. Please try again.
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
                className="mt-4 w-full btn-ghost py-2 text-primary-400 hover:text-primary-300"
              >
                {showAll ? 'Show Less' : `Show All (${rates.rates.length} currencies)`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
