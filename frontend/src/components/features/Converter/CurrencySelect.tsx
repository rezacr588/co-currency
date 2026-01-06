import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Currency } from '../../../types';
import { CURRENCY_FLAGS } from '../../../utils/constants';
import { useLanguage } from '../../../context/LanguageContext';

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  currencies?: Currency[];
  label: string;
}

export function CurrencySelect({ value, onChange, currencies, label }: CurrencySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { t, isRTL } = useLanguage();

  const selectedCurrency = useMemo(() => {
    return currencies?.find(c => c.code === value);
  }, [currencies, value]);

  const flag = CURRENCY_FLAGS[value] || '🌍';

  const filteredCurrencies = useMemo(() => {
    if (!currencies) return [];
    if (!search.trim()) return currencies;

    const searchLower = search.toLowerCase().trim();
    return currencies.filter(c =>
      c.code.toLowerCase().includes(searchLower) ||
      c.name.toLowerCase().includes(searchLower)
    );
  }, [currencies, search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedItem = listRef.current.querySelector('[data-selected="true"]');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen]);

  const handleSelect = useCallback((code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearch('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
    } else if (e.key === 'Enter' && filteredCurrencies.length > 0) {
      handleSelect(filteredCurrencies[0].code);
    }
  }, [filteredCurrencies, handleSelect]);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
        {label}
      </label>

      {/* Selected Currency Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-left hover:border-indigo-400 dark:hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all duration-200 group"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-2xl flex-shrink-0">{flag}</span>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-slate-800 dark:text-white text-sm">{value}</span>
          {selectedCurrency && (
            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
              {selectedCurrency.name}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 overflow-hidden animate-fade-in ${isRTL ? 'right-0' : 'left-0'}`}
          style={{ maxHeight: '280px' }}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/50">
            <div className="relative">
              <svg
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${isRTL ? 'right-2.5' : 'left-2.5'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('searchCurrency')}
                className={`w-full bg-slate-50 dark:bg-slate-700/50 border-0 rounded-lg py-2 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isRTL ? 'pr-8 pl-3' : 'pl-8 pr-3'}`}
              />
            </div>
          </div>

          {/* Currency List */}
          <ul
            ref={listRef}
            className="overflow-y-auto"
            style={{ maxHeight: '220px' }}
            role="listbox"
          >
            {filteredCurrencies.length > 0 ? (
              filteredCurrencies.map((currency) => {
                const currencyFlag = CURRENCY_FLAGS[currency.code] || '🌍';
                const isSelected = currency.code === value;

                return (
                  <li
                    key={currency.code}
                    data-selected={isSelected}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(currency.code)}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{currencyFlag}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{currency.code}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                        {currency.name}
                      </span>
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('noCurrencyFound')}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
