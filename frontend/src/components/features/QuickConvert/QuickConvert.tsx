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

const QUICK_CONVERSIONS_AR = [
  { from: 'USD', to: 'EUR', amount: 100 },
  { from: 'USD', to: 'GBP', amount: 100 },
  { from: 'EUR', to: 'USD', amount: 100 },
  { from: 'USD', to: 'SAR', amount: 100 },
  { from: 'USD', to: 'AED', amount: 100 },
  { from: 'EUR', to: 'GBP', amount: 100 },
];

const QUICK_CONVERSIONS_TR = [
  { from: 'USD', to: 'TRY', amount: 1 },
  { from: 'EUR', to: 'TRY', amount: 1 },
  { from: 'GBP', to: 'TRY', amount: 1 },
  { from: 'TRY', to: 'USD', amount: 100 },
  { from: 'USD', to: 'EUR', amount: 100 },
  { from: 'EUR', to: 'GBP', amount: 100 },
];

const CONVERSIONS_MAP: Record<string, typeof QUICK_CONVERSIONS_EN> = {
  en: QUICK_CONVERSIONS_EN,
  fa: QUICK_CONVERSIONS_FA,
  ar: QUICK_CONVERSIONS_AR,
  tr: QUICK_CONVERSIONS_TR,
};

export function QuickConvert() {
  const { t, language } = useLanguage();

  const conversions = CONVERSIONS_MAP[language] || QUICK_CONVERSIONS_EN;

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('quickConversions')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2">
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
