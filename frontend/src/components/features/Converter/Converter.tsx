import { useState } from 'react';
import { useConvert, useCurrencies } from '../../../hooks';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui';
import { AmountInput } from './AmountInput';
import { CurrencySelect } from './CurrencySelect';
import { SwapButton } from './SwapButton';
import { ResultDisplay } from './ResultDisplay';

export function Converter() {
  const [amount, setAmount] = useState(1);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');

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
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-xl">Currency Converter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <AmountInput value={amount} onChange={setAmount} />

        <div className="flex items-end gap-4">
          <div className="flex-1">
            <CurrencySelect
              value={fromCurrency}
              onChange={setFromCurrency}
              currencies={currencies}
              label="From"
            />
          </div>

          <SwapButton onClick={handleSwap} />

          <div className="flex-1">
            <CurrencySelect
              value={toCurrency}
              onChange={setToCurrency}
              currencies={currencies}
              label="To"
            />
          </div>
        </div>

        <ResultDisplay
          result={result}
          isLoading={isLoading}
          error={error}
        />
      </CardContent>
    </Card>
  );
}
