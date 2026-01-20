import { InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? (label || error ? generatedId : undefined);
    const errorId = error && inputId ? `${inputId}-error` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={`input ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
