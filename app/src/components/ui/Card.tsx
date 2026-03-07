import { forwardRef, type ReactNode } from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'styled-components/native';

type CardVariant = 'default' | 'glass' | 'gradient' | 'elevated';

interface CardProps extends ViewProps {
  variant?: CardVariant;
}

export const Card = forwardRef<View, CardProps>(
  ({ variant = 'default', children, style, ...props }, ref) => {
    const theme = useTheme();

    const baseStyle = {
      borderRadius: theme.radii.xl,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    };

    if (variant === 'glass') {
      return (
        <View
          ref={ref}
          style={[
            {
              ...baseStyle,
              overflow: 'hidden',
              backgroundColor: theme.glass.backgroundColor,
              borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
            theme.shadows.sm,
            style,
          ]}
          {...props}
        >
          <BlurView
            intensity={theme.glass.intensity}
            tint={theme.glass.tint}
            style={{ margin: -theme.spacing.lg, padding: theme.spacing.lg }}
          >
            {children}
          </BlurView>
        </View>
      );
    }

    if (variant === 'gradient') {
      return (
        <View
          ref={ref}
          style={[
            {
              ...baseStyle,
              overflow: 'hidden',
              borderColor: theme.colors.accent + '33',
            },
            theme.shadows.md,
            style,
          ]}
          {...props}
        >
          <LinearGradient
            colors={theme.gradients.card as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ margin: -theme.spacing.lg, padding: theme.spacing.lg }}
          >
            {children}
          </LinearGradient>
        </View>
      );
    }

    const variantStyle =
      variant === 'elevated'
        ? {
            backgroundColor: theme.colors.cardElevated,
            ...theme.shadows.md,
          }
        : {
            backgroundColor: theme.colors.card,
            ...theme.shadows.sm,
          };

    return (
      <View
        ref={ref}
        style={[baseStyle, variantStyle, style]}
        {...props}
      >
        {children}
      </View>
    );
  }
);

Card.displayName = 'Card';

type CardHeaderProps = ViewProps;

export const CardHeader = forwardRef<View, CardHeaderProps>(
  ({ children, style, ...props }, ref) => {
    const theme = useTheme();
    return (
      <View
        ref={ref}
        style={[{ marginBottom: theme.spacing.lg }, style]}
        {...props}
      >
        {children}
      </View>
    );
  }
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps {
  children: ReactNode;
  style?: any;
}

export function CardTitle({ children, style }: CardTitleProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        {
          fontSize: theme.typography.h3.fontSize,
          fontFamily: theme.typography.h3.fontFamily,
          lineHeight: theme.typography.h3.lineHeight,
          letterSpacing: theme.typography.h3.letterSpacing,
          color: theme.colors.foreground,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

type CardContentProps = ViewProps;

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

type CardFooterProps = ViewProps;

export const CardFooter = forwardRef<View, CardFooterProps>(
  ({ children, style, ...props }, ref) => {
    const theme = useTheme();
    return (
      <View
        ref={ref}
        style={[
          {
            marginTop: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          },
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    );
  }
);

CardFooter.displayName = 'CardFooter';
