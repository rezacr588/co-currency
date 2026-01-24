import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from './Modal';
import { formatNumber } from '../../utils/format';
import { CURRENCY_FLAGS } from '../../utils/constants';

interface CurrencyOption {
  code: string;
  name: string;
  balance?: number;
}

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  currencies: CurrencyOption[];
  label: string;
  showBalance?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function CurrencySelect({
  value,
  onChange,
  currencies,
  label,
  showBalance,
  isOpen,
  onClose,
}: CurrencySelectProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { t, isRTL } = useLanguage();

  const filteredCurrencies = useMemo(() => {
    if (!search.trim()) return currencies;
    const searchLower = search.toLowerCase().trim();
    return currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(searchLower) ||
        c.name.toLowerCase().includes(searchLower)
    );
  }, [currencies, search]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={label}
      size="md"
    >
      <div className="space-y-4 -mt-2">
        {/* Search */}
        <div className="relative">
          <Search
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${
              isRTL ? 'right-3' : 'left-3'
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchCurrency')}
            className={`w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600/50 ${
              isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'
            }`}
          />
        </div>

        {/* Currency List */}
        <ul className="max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar space-y-1">
          {filteredCurrencies.length > 0 ? (
            filteredCurrencies.map((currency) => {
              const flag = CURRENCY_FLAGS[currency.code] || '🌍';
              const isSelected = currency.code === value;

              return (
                <li
                  key={currency.code}
                  onClick={() => {
                    onChange(currency.code);
                    onClose();
                    setSearch('');
                  }}
                  className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-all rounded-xl ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-600/20 text-primary-800 dark:text-primary-400 ring-1 ring-primary-500/50'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{flag}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm block">
                      {currency.code}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                      {currency.name}
                    </span>
                  </div>
                  {showBalance && currency.balance !== undefined && (
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {formatNumber(currency.balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                  {isSelected && (
                    <Check className="w-5 h-5 text-primary-600 flex-shrink-0" />
                  )}
                </li>
              );
            })
          ) : (
            <li className="px-3 py-8 text-center text-sm text-slate-500">
              {t('noCurrencyFound')}
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
