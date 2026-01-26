import { View, Text, ViewProps } from 'react-native';
import { forwardRef } from 'react';

type CardVariant = 'default' | 'glass' | 'gradient';

interface CardProps extends ViewProps {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-card',
  glass: 'bg-card/80',
  gradient: 'bg-card border border-accent/20',
};

export const Card = forwardRef<View, CardProps>(
  ({ variant = 'default', className = '', children, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={`rounded-xl p-4 ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </View>
    );
  }
);

Card.displayName = 'Card';

interface CardHeaderProps extends ViewProps {}

export const CardHeader = forwardRef<View, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <View ref={ref} className={`mb-4 ${className}`} {...props}>
        {children}
      </View>
    );
  }
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <Text className={`text-lg font-semibold text-foreground ${className}`}>
      {children}
    </Text>
  );
}

interface CardContentProps extends ViewProps {}

export const CardContent = forwardRef<View, CardContentProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <View ref={ref} className={className} {...props}>
        {children}
      </View>
    );
  }
);

CardContent.displayName = 'CardContent';

interface CardFooterProps extends ViewProps {}

export const CardFooter = forwardRef<View, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <View ref={ref} className={`mt-4 pt-4 border-t border-border ${className}`} {...props}>
        {children}
      </View>
    );
  }
);

CardFooter.displayName = 'CardFooter';
