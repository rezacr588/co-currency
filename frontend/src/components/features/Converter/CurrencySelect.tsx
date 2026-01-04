import { useMemo } from 'react';
import type { Currency } from '../../../types';
import { CURRENCY_FLAGS } from '../../../utils/constants';

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  currencies?: Currency[];
  label: string;
}

export function CurrencySelect({ value, onChange, currencies, label }: CurrencySelectProps) {
  const options = useMemo(() => {
    if (!currencies) return [];
    return currencies.map((c) => ({
      value: c.code,
      label: `${CURRENCY_FLAGS[c.code] || ''} ${c.code} - ${c.name}`,
    }));
  }, [currencies]);

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-400 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select w-full text-lg font-medium"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
