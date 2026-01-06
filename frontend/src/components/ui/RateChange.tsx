import { HTMLAttributes, forwardRef } from 'react';
import { getRateChangeStatus, calculatePercentChange } from '../../utils/format';

interface RateChangeProps extends HTMLAttributes<HTMLSpanElement> {
  currentRate: number;
  previousRate: number;
  showPercent?: boolean;
  showArrow?: boolean;
}

const ArrowUp = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const ArrowDown = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const Neutral = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
  </svg>
);

export const RateChange = forwardRef<HTMLSpanElement, RateChangeProps>(
  ({ currentRate, previousRate, showPercent = true, showArrow = true, className = '', ...props }, ref) => {
    const status = getRateChangeStatus(currentRate, previousRate);
    const percentChange = calculatePercentChange(currentRate, previousRate);

    const statusStyles = {
      up: 'rate-up',
      down: 'rate-down',
      neutral: 'rate-neutral',
    };

    const icons = {
      up: <ArrowUp />,
      down: <ArrowDown />,
      neutral: <Neutral />,
    };

    return (
      <span
        ref={ref}
        className={`${statusStyles[status]} ${className}`}
        {...props}
      >
        {showArrow && icons[status]}
        {showPercent && (
          <span>
            {status === 'up' ? '+' : status === 'down' ? '' : ''}
            {percentChange.toFixed(2)}%
          </span>
        )}
      </span>
    );
  }
);

RateChange.displayName = 'RateChange';
