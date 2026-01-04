import { HTMLAttributes, forwardRef } from 'react';

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({ className = '', cols = 1, gap = 'md', children, ...props }, ref) => {
    const colClasses = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    };

    const gapClasses = {
      sm: 'gap-4',
      md: 'gap-6',
      lg: 'gap-8',
    };

    return (
      <div
        ref={ref}
        className={`grid ${colClasses[cols]} ${gapClasses[gap]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Grid.displayName = 'Grid';
