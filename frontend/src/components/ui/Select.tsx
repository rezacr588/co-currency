import { SelectHTMLAttributes, forwardRef, ReactNode, useId } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: Array<{ value: string; label: string }>;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, options, children, id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? (label ? generatedId : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`select ${className}`}
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
