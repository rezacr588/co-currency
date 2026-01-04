import { useState } from 'react';
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

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <CardTitle>{t('historicalRates')}</CardTitle>
        <div className="flex gap-2 flex-wrap">
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
            className="select w-24"
          >
            {currencies?.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
          <span className="text-slate-400 self-center">{t('to')}</span>
          <select
            value={targetCurrency}
            onChange={(e) => setTargetCurrency(e.target.value)}
            className="select w-24"
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
      </CardContent>
    </Card>
  );
}
