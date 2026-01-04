import { Card, CardContent, CardHeader, CardTitle } from '../../ui';
import { QuickConvertCard } from './QuickConvertCard';

const QUICK_CONVERSIONS = [
  { from: 'USD', to: 'EUR', amount: 100 },
  { from: 'USD', to: 'GBP', amount: 100 },
  { from: 'EUR', to: 'USD', amount: 100 },
  { from: 'GBP', to: 'USD', amount: 100 },
  { from: 'USD', to: 'JPY', amount: 100 },
  { from: 'EUR', to: 'GBP', amount: 100 },
];

export function QuickConvert() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Quick Conversions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_CONVERSIONS.map((conv, i) => (
            <QuickConvertCard
              key={i}
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
