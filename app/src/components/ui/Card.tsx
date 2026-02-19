import { View, Text, ViewProps } from 'react-native';
import { forwardRef } from 'react';
import { useTheme } from 'styled-components/native';

type CardVariant = 'default' | 'glass' | 'gradient';

interface CardProps extends ViewProps {
  variant?: CardVariant;
}

export const Card = forwardRef<View, CardProps>(
  ({ variant = 'default', children, style, ...props }, ref) => {
    const theme = useTheme();
    const colors = theme.colors;

    const variantStyles: Record<CardVariant, any> = {
      default: { backgroundColor: colors.card },
      glass: { backgroundColor: colors.card + 'cc' },
      gradient: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent + '33' },
    };

    return (
      <View
        ref={ref}
        style={[{ borderRadius: 12, padding: 16, ...variantStyles[variant] }, style]}
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
  ({ children, style, ...props }, ref) => {
    return (
      <View ref={ref} style={[{ marginBottom: 16 }, style]} {...props}>
        {children}
      </View>
    );
  }
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps {
  children: React.ReactNode;
  style?: any;
}

export function CardTitle({ children, style }: CardTitleProps) {
  const theme = useTheme();
  const colors = theme.colors;
  return (
    <Text style={[{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground }, style]}>
      {children}
    </Text>
  );
}

interface CardContentProps extends ViewProps {}

export const CardContent = forwardRef<View, CardContentProps>(
  ({ children, style, ...props }, ref) => {
    return (
      <View ref={ref} style={style} {...props}>
        {children}
      </View>
    );
  }
);

CardContent.displayName = 'CardContent';

interface CardFooterProps extends ViewProps {}

export const CardFooter = forwardRef<View, CardFooterProps>(
  ({ children, style, ...props }, ref) => {
    const theme = useTheme();
    const colors = theme.colors;
    return (
      <View ref={ref} style={[{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }, style]} {...props}>
        {children}
      </View>
    );
  }
);

CardFooter.displayName = 'CardFooter';
