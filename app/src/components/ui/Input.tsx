import { forwardRef, useId } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className = '', ...props }, ref) => {
    const id = useId();

    return (
      <View className="w-full">
        {label && (
          <Text className="text-sm text-muted-foreground mb-2">{label}</Text>
        )}
        <View
          className={`
            bg-card rounded-xl flex-row items-center px-4
            ${error ? 'border border-danger' : ''}
          `}
        >
          {leftIcon && <View className="mr-3">{leftIcon}</View>}
          <TextInput
            ref={ref}
            className={`flex-1 py-4 text-foreground ${className}`}
            placeholderTextColor="rgb(148, 163, 184)"
            {...props}
          />
          {rightIcon && <View className="ml-3">{rightIcon}</View>}
        </View>
        {error && (
          <Text className="text-sm text-danger mt-1">{error}</Text>
        )}
        {hint && !error && (
          <Text className="text-sm text-muted-foreground mt-1">{hint}</Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';
