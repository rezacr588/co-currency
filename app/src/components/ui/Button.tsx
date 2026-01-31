import { forwardRef, useCallback } from 'react';
import { Pressable, Text, ActivityIndicator, PressableProps, View, GestureResponderEvent } from 'react-native';
import { haptics } from '../../utils/haptics';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  hapticFeedback?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:bg-primary-hover',
  secondary: 'bg-secondary active:bg-secondary/80',
  ghost: 'bg-transparent active:bg-secondary/50',
  danger: 'bg-danger active:bg-danger/80',
  success: 'bg-success active:bg-success/80',
  outline: 'bg-transparent border border-border active:bg-secondary/50',
};

const variantTextStyles: Record<ButtonVariant, string> = {
  primary: 'text-primary-foreground',
  secondary: 'text-foreground',
  ghost: 'text-foreground',
  danger: 'text-white',
  success: 'text-white',
  outline: 'text-foreground',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2',
  md: 'px-4 py-3',
  lg: 'px-6 py-4',
};

const textSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
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
      className = '',
      hapticFeedback = true,
      onPress,
      ...props
    },
    ref
  ) => {
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

    return (
      <Pressable
        ref={ref}
        disabled={isDisabled}
        onPress={handlePress}
        className={`
          flex-row items-center justify-center rounded-xl
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${isDisabled ? 'opacity-50' : ''}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'primary'
                ? '#09090b'
                : variant === 'ghost' || variant === 'outline'
                  ? 'rgb(248, 250, 252)'
                  : 'white'
            }
          />
        ) : (
          <>
            {leftIcon && <View className="mr-2">{leftIcon}</View>}
            <Text
              className={`font-semibold ${variantTextStyles[variant]} ${textSizeStyles[size]}`}
            >
              {children}
            </Text>
            {rightIcon && <View className="ml-2">{rightIcon}</View>}
          </>
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';
