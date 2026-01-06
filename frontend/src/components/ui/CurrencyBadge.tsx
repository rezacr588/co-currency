import { HTMLAttributes, forwardRef } from 'react';
import { getCurrencyDisplay } from '../../utils/format';

interface CurrencyBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  code: string;
  showFlag?: boolean;
  showSymbol?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export const CurrencyBadge = forwardRef<HTMLSpanElement, CurrencyBadgeProps>(
  ({ code, showFlag = true, showSymbol = false, size = 'md', className = '', ...props }, ref) => {
    const { flag, symbol } = getCurrencyDisplay(code);

    return (
      <span
        ref={ref}
        className={`currency-badge ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {showFlag && <span className="text-base">{flag}</span>}
        <span className="font-semibold">{code}</span>
        {showSymbol && <span className="text-slate-500 dark:text-slate-400">({symbol})</span>}
      </span>
    );
  }
);

CurrencyBadge.displayName = 'CurrencyBadge';
