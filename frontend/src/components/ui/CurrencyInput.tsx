import { useState, useEffect, useRef } from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  currencyCode: string;
  currencySymbol?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Formats a number with thousand separators (commas)
 */
function formatNumberWithCommas(num: string): string {
  // Remove any existing commas and non-numeric characters except decimal point
  const cleanNum = num.replace(/[^\d.]/g, '');

  // Split into integer and decimal parts
  const parts = cleanNum.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Add commas to integer part
  const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Return with decimal if it exists
  return decimalPart !== undefined ? `${formatted}.${decimalPart}` : formatted;
}

/**
 * Removes commas from formatted number string
 */
function removeCommas(str: string): string {
  return str.replace(/,/g, '');
}

/**
 * A formatted currency input that displays values like banking transactions
 * with currency symbols and comma separators
 */
export function CurrencyInput({
  value,
  onChange,
  currencyCode,
  currencySymbol = '',
  placeholder = '0',
  className = '',
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update display value when value prop changes (from external source)
  useEffect(() => {
    if (!isFocused) {
      if (value === 0 || value === null || value === undefined) {
        setDisplayValue('');
      } else {
        setDisplayValue(formatNumberWithCommas(value.toString()));
      }
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Allow empty input
    if (input === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Remove commas for parsing
    const rawValue = removeCommas(input);

    // Validate input (allow digits and one decimal point)
    if (!/^\d*\.?\d*$/.test(rawValue)) {
      return; // Invalid input, don't update
    }

    // Check max value
    const numValue = parseFloat(rawValue);
    if (!isNaN(numValue)) {
      if (numValue < 0) {
        return; // Don't allow negative
      }
      if (numValue > 999999999999) {
        return; // Don't allow values larger than max
      }

      // Update the formatted display
      setDisplayValue(formatNumberWithCommas(rawValue));

      // Update the actual numeric value
      onChange(numValue);
    } else if (rawValue.endsWith('.')) {
      // Allow typing decimal point
      setDisplayValue(formatNumberWithCommas(rawValue));
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);

    // Clean up the display value on blur
    if (value === 0 || value === null || value === undefined) {
      setDisplayValue('');
    } else {
      setDisplayValue(formatNumberWithCommas(value.toString()));
    }
  };

  return (
    <div className="relative flex-1 min-w-0">
      {/* Currency Symbol */}
      {currencySymbol && displayValue && (
        <div className="absolute left-2 sm:left-3 md:left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <span className="text-sm sm:text-base md:text-lg text-slate-400 dark:text-slate-500 font-light">
            {currencySymbol}
          </span>
        </div>
      )}

      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full bg-transparent py-2 sm:py-3 text-lg sm:text-xl md:text-2xl font-light text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none tabular-nums truncate ${
          currencySymbol && displayValue ? 'pl-8 sm:pl-10 md:pl-12 pr-2 sm:pr-3 md:pr-4' : 'px-2 sm:px-3 md:px-4'
        } ${className}`}
        aria-label={`Amount in ${currencyCode}`}
      />
    </div>
  );
}
