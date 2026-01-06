import { HTMLAttributes, forwardRef } from 'react';

interface InfoMessageProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export const InfoMessage = forwardRef<HTMLDivElement, InfoMessageProps>(
  ({ title, className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`info-message ${className}`}
      role="status"
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
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        <p className={title ? 'text-sm opacity-80' : ''}>{children}</p>
      </div>
    </div>
  )
);

InfoMessage.displayName = 'InfoMessage';
