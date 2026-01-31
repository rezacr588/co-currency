import { forwardRef, useId } from 'react';
import { View, Text, TextInput, TextInputProps, AccessibilityInfo } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  // Accessibility props
  accessibilityHint?: string;
  required?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      className = '',
      accessibilityHint,
      required,
      ...props
    },
    ref
  ) => {
    const id = useId();

    // Build accessibility label
    const accessibilityLabel = [
      label,
      required ? 'required' : undefined,
      error ? `Error: ${error}` : undefined,
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <View className="w-full" accessible={false}>
        {label && (
          <Text
            className="text-sm text-muted-foreground mb-2"
            accessibilityRole="text"
            nativeID={`${id}-label`}
          >
            {label}
            {required && <Text className="text-danger"> *</Text>}
          </Text>
        )}
        <View
          className={`
            bg-card rounded-xl flex-row items-center px-4
            ${error ? 'border border-danger' : ''}
          `}
        >
          {leftIcon && (
            <View className="mr-3" accessibilityElementsHidden>
              {leftIcon}
            </View>
          )}
          <TextInput
            ref={ref}
            className={`flex-1 py-4 text-foreground ${className}`}
            placeholderTextColor="rgb(148, 163, 184)"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint || hint}
            accessibilityState={{
              disabled: props.editable === false,
            }}
            accessibilityLabelledBy={label ? `${id}-label` : undefined}
            {...props}
          />
          {rightIcon && (
            <View className="ml-3" accessibilityElementsHidden>
              {rightIcon}
            </View>
          )}
        </View>
        {error && (
          <Text
            className="text-sm text-danger mt-1"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {error}
          </Text>
        )}
        {hint && !error && (
          <Text
            className="text-sm text-muted-foreground mt-1"
            accessibilityRole="text"
            nativeID={`${id}-hint`}
          >
            {hint}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';
