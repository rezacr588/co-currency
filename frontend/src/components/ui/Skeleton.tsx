import { HTMLAttributes, forwardRef } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className = '', width, height, style, ...props }, ref) => (
    <div
      ref={ref}
      className={`animate-pulse bg-slate-200 dark:bg-slate-700/50 rounded-lg ${className}`}
      style={{ width, height, ...style }}
      {...props}
    />
  )
);

Skeleton.displayName = 'Skeleton';

export function SkeletonCard() {
  return (
    <div className="p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-4">
      <Skeleton height={24} width="60%" />
      <Skeleton height={48} />
      <div className="flex gap-4">
        <Skeleton height={40} className="flex-1" />
        <Skeleton height={40} className="flex-1" />
      </div>
    </div>
  );
}

export function SkeletonRateCard() {
  return (
    <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40 flex items-center gap-4">
      <Skeleton width={40} height={40} className="rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton height={20} width="40%" />
        <Skeleton height={16} width="60%" />
      </div>
      <Skeleton height={24} width={80} />
    </div>
  );
}
