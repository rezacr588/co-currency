import { HTMLAttributes, forwardRef } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className = '', width, height, style, ...props }, ref) => (
    <div
      ref={ref}
      className={`skeleton ${className}`}
      style={{ width, height, ...style }}
      {...props}
    />
  )
);

Skeleton.displayName = 'Skeleton';

export function SkeletonCard() {
  return (
    <div className="card p-6 space-y-4">
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
    <div className="card p-4 flex items-center gap-4">
      <Skeleton width={40} height={40} className="rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton height={20} width="40%" />
        <Skeleton height={16} width="60%" />
      </div>
      <Skeleton height={24} width={80} />
    </div>
  );
}
