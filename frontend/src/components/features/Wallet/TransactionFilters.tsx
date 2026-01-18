import { useState } from 'react';
import { Button, Input, Select, Card } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';
import type { TransactionFilter } from '../../../types/wallet';
import { DEFAULT_CATEGORIES } from '../../../types/wallet';

interface TransactionFiltersProps {
  filter: TransactionFilter;
  onFilterChange: (filter: TransactionFilter) => void;
  onExport?: () => void;
  currencies?: string[];
}

export function TransactionFilters({
  filter,
  onFilterChange,
  onExport,
  currencies = ['USD', 'EUR', 'GBP', 'IRR'],
}: TransactionFiltersProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key: keyof TransactionFilter, value: string) => {
    onFilterChange({ ...filter, [key]: value || undefined });
  };

  const clearFilters = () => {
    onFilterChange({});
  };

  const hasActiveFilters = Object.values(filter).some(v => v);

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input always visible */}
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder={t('searchTransactions') || 'Search transactions...'}
            value={filter.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
          />
        </div>

        {/* Toggle filters button */}
        <Button
          variant="secondary"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {t('filters') || 'Filters'}
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-primary-700 rounded-full" />
          )}
        </Button>

        {/* Export button */}
        {onExport && (
          <Button variant="secondary" onClick={onExport} className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t('export') || 'Export'}
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category filter */}
            <Select
              label={t('category') || 'Category'}
              value={filter.category || ''}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              <option value="">{t('allCategories') || 'All Categories'}</option>
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.icon} {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                </option>
              ))}
            </Select>

            {/* Type filter */}
            <Select
              label={t('type') || 'Type'}
              value={filter.type || ''}
              onChange={(e) => handleChange('type', e.target.value)}
            >
              <option value="">{t('allTypes') || 'All Types'}</option>
              <option value="credit">{t('credit') || 'Credit'}</option>
              <option value="debit">{t('debit') || 'Debit'}</option>
              <option value="convert">{t('convert') || 'Convert'}</option>
            </Select>

            {/* Currency filter */}
            <Select
              label={t('currency') || 'Currency'}
              value={filter.currency || ''}
              onChange={(e) => handleChange('currency', e.target.value)}
            >
              <option value="">{t('allCurrencies') || 'All Currencies'}</option>
              {currencies.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </Select>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                label={t('fromDate') || 'From'}
                type="date"
                value={filter.from_date || ''}
                onChange={(e) => handleChange('from_date', e.target.value)}
              />
              <Input
                label={t('toDate') || 'To'}
                type="date"
                value={filter.to_date || ''}
                onChange={(e) => handleChange('to_date', e.target.value)}
              />
            </div>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <div className="mt-4">
              <Button variant="secondary" onClick={clearFilters}>
                {t('clearFilters') || 'Clear Filters'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
