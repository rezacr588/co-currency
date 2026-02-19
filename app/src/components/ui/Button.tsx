import { forwardRef, useCallback } from 'react';
import { Pressable, Text, ActivityIndicator, PressableProps, View, GestureResponderEvent } from 'react-native';
import { haptics } from '../../utils/haptics';
import { useTheme } from 'styled-components/native';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  hapticFeedback?: boolean;
  // Accessibility
  accessibilityHint?: string;
}

const sizeConfig: Record<ButtonSize, { px: number; py: number; fontSize: number }> = {
  sm: { px: 12, py: 8, fontSize: 14 },
  md: { px: 16, py: 12, fontSize: 16 },
  lg: { px: 24, py: 16, fontSize: 18 },
};

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      hapticFeedback = true,
      onPress,
      accessibilityHint,
      accessibilityLabel,
      style,
      ...props
    },
    ref
  ) => {
    const theme = useTheme();
    const colors = theme.colors;
    const isDisabled = disabled || isLoading;

    const handlePress = useCallback(
      (event: GestureResponderEvent) => {
        if (hapticFeedback) {
          haptics.light();
        }
        onPress?.(event);
      },
      [hapticFeedback, onPress]
    );

    // Generate accessibility label from children if not provided
    const buttonLabel =
      accessibilityLabel ||
      (typeof children === 'string' ? children : undefined);

    const variantBgColors: Record<ButtonVariant, string> = {
      primary: colors.primary,
      secondary: colors.secondary,
      ghost: 'transparent',
      danger: colors.danger,
      success: colors.success,
      outline: 'transparent',
      accent: colors.accent,
    };

    const variantTextColors: Record<ButtonVariant, string> = {
      primary: colors.primaryForeground,
      secondary: colors.foreground,
      ghost: colors.foreground,
      danger: '#ffffff',
      success: '#ffffff',
      outline: colors.foreground,
      accent: colors.accentForeground,
    };

    const sizeVal = sizeConfig[size];

    return (
      <Pressable
        ref={ref}
        disabled={isDisabled}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          disabled: isDisabled,
          busy: isLoading,
        }}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            backgroundColor: variantBgColors[variant],
            paddingHorizontal: sizeVal.px,
            paddingVertical: sizeVal.py,
            opacity: isDisabled ? 0.4 : 1,
            borderWidth: variant === 'outline' ? 1 : 0,
            borderColor: variant === 'outline' ? colors.border : undefined,
          },
          ...(Array.isArray(style) ? (style as any[]) : typeof style === 'object' && style ? [style] : []),
        ]}
        {...props}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'primary' || variant === 'accent'
                ? colors.primaryForeground
                : colors.foreground
            }
          />
        ) : (
          <>
            {leftIcon && <View style={{ marginRight: 8 }}>{leftIcon}</View>}
            <Text
              style={{ fontFamily: 'Inter_600SemiBold', color: variantTextColors[variant], fontSize: sizeVal.fontSize }}
            >
              {children}
            </Text>
            {rightIcon && <View style={{ marginLeft: 8 }}>{rightIcon}</View>}
          </>
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';
