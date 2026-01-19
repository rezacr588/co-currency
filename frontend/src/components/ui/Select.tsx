import { SelectHTMLAttributes, forwardRef, ReactNode } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: Array<{ value: string; label: string }>;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, options, children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-600/30 focus:border-primary-600 transition-all ${className}`}
          {...props}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
      </div>
    );
  }
);

Select.displayName = 'Select';
