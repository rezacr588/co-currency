import { useCallback, type ReactNode } from 'react';
import {
  Pressable,
  ActivityIndicator,
  type PressableProps,
  type GestureResponderEvent,
  View,
} from 'react-native';
import styled, { useTheme } from 'styled-components/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { haptics } from '../../../utils/haptics';
import { BodyMedium } from './StyledText';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

interface StyledButtonProps extends Omit<PressableProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
  hapticFeedback?: boolean;
  accessibilityHint?: string;
}

const sizeMap = {
  sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 13 },
  md: { paddingVertical: 12, paddingHorizontal: 16, fontSize: 15 },
  lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 17 },
} as const;

const IconSlot = styled.View<{ side: 'left' | 'right' }>`
  margin-left: ${({ side }) => (side === 'right' ? 8 : 0)}px;
  margin-right: ${({ side }) => (side === 'left' ? 8 : 0)}px;
`;

export function StyledButton({
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
}: StyledButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const isDisabled = disabled || isLoading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (hapticFeedback) haptics.light();
      onPress?.(event);
    },
    [hapticFeedback, onPress]
  );

  const variantColors: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
    primary: { bg: theme.colors.primary, text: theme.colors.primaryForeground },
    secondary: { bg: theme.colors.secondary, text: theme.colors.secondaryForeground },
    ghost: { bg: 'transparent', text: theme.colors.foreground },
    danger: { bg: theme.colors.danger, text: '#ffffff' },
    success: { bg: theme.colors.success, text: '#ffffff' },
    outline: { bg: 'transparent', text: theme.colors.foreground, border: theme.colors.border },
    accent: { bg: theme.colors.accent, text: theme.colors.accentForeground },
  };

  const colors = variantColors[variant];
  const sizeConfig = sizeMap[size];
  const buttonLabel =
    accessibilityLabel || (typeof children === 'string' ? children : undefined);

  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={colors.text}
        />
      ) : (
        <>
          {leftIcon && <IconSlot side="left">{leftIcon}</IconSlot>}
          <BodyMedium
            $color={colors.text}
            style={{ fontSize: sizeConfig.fontSize }}
          >
            {children}
          </BodyMedium>
          {rightIcon && <IconSlot side="right">{rightIcon}</IconSlot>}
        </>
      )}
    </View>
  );

  const baseStyle = {
    paddingVertical: sizeConfig.paddingVertical,
    paddingHorizontal: sizeConfig.paddingHorizontal,
    borderRadius: theme.radii.xl,
    opacity: isDisabled ? 0.4 : 1,
    overflow: 'hidden' as const,
    ...(colors.border ? { borderWidth: 1, borderColor: colors.border } : {}),
  };

  if (variant === 'accent') {
    return (
      <AnimatedPressable
        disabled={isDisabled}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: isLoading }}
        style={[animatedStyle, baseStyle, style as any]}
        {...props}
      >
        <LinearGradient
          colors={theme.gradients.accent as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        {content}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      disabled={isDisabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={buttonLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      style={[
        animatedStyle,
        { ...baseStyle, backgroundColor: colors.bg },
        style as any,
      ]}
      {...props}
    >
      {content}
    </AnimatedPressable>
  );
}
