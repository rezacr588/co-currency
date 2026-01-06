import { HTMLAttributes, forwardRef } from 'react';

interface ErrorMessageProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorMessage = forwardRef<HTMLDivElement, ErrorMessageProps>(
  ({ title, onRetry, retryLabel = 'Retry', className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`error-message ${className}`}
      role="alert"
      {...props}
    >
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        <p className={title ? 'text-sm opacity-80' : ''}>{children}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1 text-sm font-medium bg-rose-100 dark:bg-rose-800/30 hover:bg-rose-200 dark:hover:bg-rose-800/50 rounded-lg transition-colors"
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
);

ErrorMessage.displayName = 'ErrorMessage';
