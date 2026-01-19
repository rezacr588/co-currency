import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Globe } from 'lucide-react';
import type { Currency } from '../../../types';
import { CURRENCY_FLAGS } from '../../../utils/constants';
import { useLanguage } from '../../../context/LanguageContext';

interface InlineCurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  currencies?: Currency[];
}

export function InlineCurrencySelect({ value, onChange, currencies }: InlineCurrencySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { t, isRTL } = useLanguage();

  const flag = CURRENCY_FLAGS[value];

  const filteredCurrencies = useMemo(() => {
    if (!currencies) return [];
    if (!search.trim()) return currencies;

    const searchLower = search.toLowerCase().trim();
    return currencies.filter(c =>
      c.code.toLowerCase().includes(searchLower) ||
      c.name.toLowerCase().includes(searchLower)
    );
  }, [currencies, search]);

  // Close dropdown when clicking outside or on backdrop
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      // Close if clicking on backdrop or outside modal
      if (target.classList.contains('currency-modal-backdrop') ||
          (containerRef.current && !containerRef.current.contains(event.target as Node))) {
        setIsOpen(false);
        setSearch('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

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
      {/* Compact Currency Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600/50 border-s border-slate-200 dark:border-slate-600 transition-colors flex items-center gap-1 sm:gap-1.5 md:gap-2 rounded-e-lg flex-shrink-0"
        aria-expanded={isOpen}
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
          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Modal Dropdown - Rendered via Portal */}
      {isOpen && createPortal(
        <div className="currency-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div
            ref={containerRef}
            className="relative w-full max-w-md mx-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                {t('selectCurrency')}
              </h3>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSearch('');
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-700/50">
              <div className="relative">
                <svg
                  className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`}
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
                  className={`w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-600/50 focus:border-primary-600 ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
                />
              </div>
            </div>

            {/* Currency List */}
            <ul
              ref={listRef}
              className="overflow-y-auto p-2"
              style={{ maxHeight: 'calc(80vh - 180px)' }}
              role="listbox"
            >
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
                      className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-all duration-150 rounded-lg ${
                        isSelected
                          ? 'bg-primary-50 dark:bg-primary-600/20 text-primary-800 dark:text-primary-400'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
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
                      {isSelected && (
                        <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t('noCurrencyFound')}
                </li>
              )}
            </ul>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
