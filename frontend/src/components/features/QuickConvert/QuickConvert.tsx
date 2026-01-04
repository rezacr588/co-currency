import { Card, CardContent, CardHeader, CardTitle } from '../../ui';
import { QuickConvertCard } from './QuickConvertCard';
import { useLanguage } from '../../../context/LanguageContext';

const QUICK_CONVERSIONS_EN = [
  { from: 'USD', to: 'EUR', amount: 100 },
  { from: 'USD', to: 'GBP', amount: 100 },
  { from: 'EUR', to: 'USD', amount: 100 },
  { from: 'GBP', to: 'USD', amount: 100 },
  { from: 'USD', to: 'JPY', amount: 100 },
  { from: 'EUR', to: 'GBP', amount: 100 },
];

const QUICK_CONVERSIONS_FA = [
  { from: 'USD', to: 'IRR', amount: 1 },
  { from: 'EUR', to: 'IRR', amount: 1 },
  { from: 'GBP', to: 'IRR', amount: 1 },
  { from: 'IRR', to: 'USD', amount: 1000000 },
  { from: 'USD', to: 'EUR', amount: 100 },
  { from: 'EUR', to: 'GBP', amount: 100 },
];

export function QuickConvert() {
  const { t, language } = useLanguage();

  const conversions = language === 'fa' ? QUICK_CONVERSIONS_FA : QUICK_CONVERSIONS_EN;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t('quickConversions')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {conversions.map((conv) => (
            <QuickConvertCard
              key={`${conv.from}-${conv.to}-${conv.amount}`}
              from={conv.from}
              to={conv.to}
              amount={conv.amount}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
