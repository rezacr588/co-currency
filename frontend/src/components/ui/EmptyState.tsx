import { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from './Card';
import { Button } from './Button';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

interface EmptyStateProps {
  icon: LucideIcon | ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardContent className="py-12 text-center">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          {typeof Icon === 'function' ? (
            <Icon className="w-12 h-12 text-primary-600 dark:text-primary-400" />
          ) : (
            <span className="text-4xl">{Icon}</span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
            {description}
          </p>
        )}

        {/* Action */}
        {action && (
          <Button
            variant={action.variant || 'primary'}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

EmptyState.displayName = 'EmptyState';
