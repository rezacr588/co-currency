import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'gradient';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const baseStyles = 'relative overflow-hidden rounded-2xl transition-all duration-300';

    const variants = {
      default: `${baseStyles} bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 shadow-lg hover:shadow-xl`,
      glass: `${baseStyles} bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30`,
      gradient: `${baseStyles} bg-gradient-to-br from-white/80 via-white/80 to-primary-50/80 dark:from-slate-900/80 dark:via-slate-900/80 dark:to-primary-950/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 shadow-lg`,
    };

    return (
      <div ref={ref} className={`${variants[variant]} ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`px-6 py-5 border-b border-slate-200/60 dark:border-slate-800/60 ${className}`} {...props}>
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', children, ...props }, ref) => (
    <h3 ref={ref} className={`text-xl font-light tracking-wide text-slate-800 dark:text-slate-100 ${className}`} {...props}>
      {children}
    </h3>
  )
);

CardTitle.displayName = 'CardTitle';
