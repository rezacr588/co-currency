import { forwardRef, useId, type ReactNode } from 'react';
import { View, TextInput, type TextInputProps } from 'react-native';
import { useTheme } from 'styled-components/native';
import styled from 'styled-components/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Caption } from './StyledText';

const LabelText = styled(Caption)`
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

const ErrorText = styled(Caption)`
  color: ${({ theme }) => theme.colors.danger};
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

const HintText = styled(Caption)`
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

interface StyledInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  accessibilityHint?: string;
  required?: boolean;
}

export const StyledInput = forwardRef<TextInput, StyledInputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      accessibilityHint,
      required,
      ...props
    },
    ref
  ) => {
    const theme = useTheme();
    const id = useId();
    const focus = useSharedValue(0);

    const handleFocus = () => {
      focus.value = withTiming(1, { duration: theme.animation.normal });
    };

    const handleBlur = () => {
      focus.value = withTiming(0, { duration: theme.animation.normal });
    };

    const containerAnimatedStyle = useAnimatedStyle(() => ({
      borderColor: error
        ? theme.colors.danger
        : interpolateColor(
            focus.value,
            [0, 1],
            [theme.colors.borderSubtle, theme.colors.accent]
          ),
    }));

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
          <LabelText nativeID={`${id}-label`}>
            {label}
            {required && <Caption $color={theme.colors.danger}> *</Caption>}
          </LabelText>
        )}
        <Animated.View
          style={[
            {
              borderRadius: theme.radii.xl,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: theme.spacing.lg,
              backgroundColor: theme.colors.card,
              borderWidth: 1.5,
            },
            containerAnimatedStyle,
            error ? theme.shadows.glow(theme.colors.danger + '40') : undefined,
          ]}
        >
          {leftIcon && (
            <View style={{ marginEnd: theme.spacing.md }} accessibilityElementsHidden>
              {leftIcon}
            </View>
          )}
          <TextInput
            ref={ref}
            placeholderTextColor={theme.colors.placeholder}
            onFocus={handleFocus}
            onBlur={handleBlur}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint || hint}
            accessibilityState={{ disabled: props.editable === false }}
            accessibilityLabelledBy={label ? `${id}-label` : undefined}
            style={{
              flex: 1,
              paddingVertical: theme.spacing.lg,
              fontSize: theme.typography.body.fontSize,
              fontFamily: theme.typography.body.fontFamily,
              color: theme.colors.foreground,
            }}
            {...props}
          />
          {rightIcon && (
            <View style={{ marginStart: theme.spacing.md }} accessibilityElementsHidden>
              {rightIcon}
            </View>
          )}
        </Animated.View>
        {error && (
          <ErrorText accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </ErrorText>
        )}
        {hint && !error && (
          <HintText nativeID={`${id}-hint`}>
            {hint}
          </HintText>
        )}
      </View>
    );
  }
);

StyledInput.displayName = 'StyledInput';
