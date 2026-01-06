import { HTMLAttributes, forwardRef } from 'react';

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant;
  icon?: React.ReactNode;
}

const variantStyles: Record<StatusVariant, string> = {
  success: 'status-success',
  warning: 'status-warning',
  error: 'status-error',
  info: 'status-info',
  neutral: 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400',
};

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ variant = 'neutral', icon, className = '', children, ...props }, ref) => (
    <span
      ref={ref}
      className={`status-badge ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </span>
  )
);

StatusBadge.displayName = 'StatusBadge';
