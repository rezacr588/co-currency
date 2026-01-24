import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Check, Globe } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from './Modal';
import { formatNumber } from '../../utils/format';
import { CURRENCY_FLAGS } from '../../utils/constants';

interface CurrencyOption {
  code: string;
  name: string;
  balance?: number;
}

type CurrencySelectVariant = 'modal' | 'inline';

interface CurrencySelectProps {
  variant?: CurrencySelectVariant;
  value: string;
  onChange: (value: string) => void;
  currencies?: CurrencyOption[];
  label?: string;
  showBalance?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function CurrencySelect({
  variant = 'modal',
  value,
  onChange,
  currencies,
  label,
  showBalance,
  isOpen,
  onClose,
}: CurrencySelectProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { t, isRTL } = useLanguage();

  const open = variant === 'modal' ? Boolean(isOpen) : internalOpen;
  const currencyList = currencies ?? [];

  const filteredCurrencies = useMemo(() => {
    if (!search.trim()) return currencyList;
    const searchLower = search.toLowerCase().trim();
    return currencyList.filter(
      (c) =>
        c.code.toLowerCase().includes(searchLower) ||
        c.name.toLowerCase().includes(searchLower)
    );
  }, [currencyList, search]);

  const close = useCallback(() => {
    if (variant === 'modal') {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  }, [onClose, variant]);

  const handleSelect = useCallback(
    (code: string) => {
      onChange(code);
      close();
      setSearch('');
    },
    [close, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        setSearch('');
      } else if (e.key === 'Enter' && filteredCurrencies.length > 0) {
        handleSelect(filteredCurrencies[0].code);
      }
    },
    [close, filteredCurrencies, handleSelect]
  );

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!open) {
      setSearch('');
    }
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const selectedItem = listRef.current.querySelector('[data-selected="true"]');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [open]);

  const title = label || t('selectCurrency');
  const flag = CURRENCY_FLAGS[value];

  const modalContent = (
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
          onKeyDown={handleKeyDown}
          placeholder={t('searchCurrency')}
          className={`w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600/50 ${
            isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'
          }`}
        />
      </div>

      {/* Currency List */}
      <ul ref={listRef} className="max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar space-y-1">
        {filteredCurrencies.length > 0 ? (
          filteredCurrencies.map((currency) => {
            const currencyFlag = CURRENCY_FLAGS[currency.code];
            const isSelected = currency.code === value;

            return (
              <li
                key={currency.code}
                data-selected={isSelected}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(currency.code)}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-all rounded-xl ${
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-600/20 text-primary-800 dark:text-primary-400 ring-1 ring-primary-500/50'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200'
                }`}
              >
                {currencyFlag ? (
                  <span className="text-2xl flex-shrink-0">{currencyFlag}</span>
                ) : (
                  <Globe className="w-6 h-6 text-slate-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm block">{currency.code}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                    {currency.name}
                  </span>
                </div>
                {showBalance && currency.balance !== undefined && (
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {formatNumber(currency.balance, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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
  );

  const modal = (
    <Modal isOpen={open} onClose={close} title={title} size="md">
      {modalContent}
    </Modal>
  );

  if (variant === 'modal') {
    return modal;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setInternalOpen((prev) => !prev)}
        className="h-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600/50 border-s border-slate-200 dark:border-slate-600 transition-colors flex items-center gap-1 sm:gap-1.5 md:gap-2 rounded-e-lg flex-shrink-0"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {flag ? (
          <span className="text-lg sm:text-xl md:text-2xl">{flag}</span>
        ) : (
          <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
        )}
        <span className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-700 dark:text-slate-200">
          {value}
        </span>
        <svg
          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {modal}
    </div>
  );
}
