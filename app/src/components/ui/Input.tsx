import { forwardRef, useId } from 'react';
import { View, Text, TextInput, TextInputProps, AccessibilityInfo } from 'react-native';
import { useTheme } from 'styled-components/native';

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
      accessibilityHint,
      required,
      style: inputStyle,
      ...props
    },
    ref
  ) => {
    const theme = useTheme();
    const colors = theme.colors;
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
      <View style={{ width: '100%' }} accessible={false}>
        {label && (
          <Text
            style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 8 }}
            accessibilityRole="text"
            nativeID={`${id}-label`}
          >
            {label}
            {required && <Text style={{ color: colors.danger }}> *</Text>}
          </Text>
        )}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            borderWidth: error ? 1 : 0,
            borderColor: error ? colors.danger : undefined,
          }}
        >
          {leftIcon && (
            <View style={{ marginEnd: 12 }} accessibilityElementsHidden>
              {leftIcon}
            </View>
          )}
          <TextInput
            ref={ref}
            style={[{ flex: 1, paddingVertical: 16, color: colors.foreground }, inputStyle]}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint || hint}
            accessibilityState={{
              disabled: props.editable === false,
            }}
            accessibilityLabelledBy={label ? `${id}-label` : undefined}
            {...props}
          />
          {rightIcon && (
            <View style={{ marginStart: 12 }} accessibilityElementsHidden>
              {rightIcon}
            </View>
          )}
        </View>
        {error && (
          <Text
            style={{ fontSize: 14, color: colors.danger, marginTop: 4 }}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {error}
          </Text>
        )}
        {hint && !error && (
          <Text
            style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 4 }}
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
