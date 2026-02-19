import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import styled, { useTheme } from 'styled-components/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { haptics } from '../../../utils/haptics';

const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_MARGIN = 3;

interface StyledToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}

const ToggleRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
`;

const LabelText = styled.Text`
  font-size: ${({ theme }) => theme.typography.body.fontSize}px;
  font-family: ${({ theme }) => theme.typography.body.fontFamily};
  color: ${({ theme }) => theme.colors.foreground};
  flex: 1;
  margin-right: ${({ theme }) => theme.spacing.md}px;
`;

export function StyledToggle({ value, onValueChange, disabled = false, label }: StyledToggleProps) {
  const theme = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.secondary, 'transparent']
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withTiming(
          value ? TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN : THUMB_MARGIN,
          { duration: 200 }
        ),
      },
    ],
  }));

  const handlePress = () => {
    if (disabled) return;
    haptics.light();
    onValueChange(!value);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
    >
      <ToggleRow>
        {label && <LabelText>{label}</LabelText>}
        <Animated.View
          style={[
            {
              width: TRACK_WIDTH,
              height: TRACK_HEIGHT,
              borderRadius: TRACK_HEIGHT / 2,
              overflow: 'hidden',
            },
            trackStyle,
          ]}
        >
          {value && (
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
          )}
          <Animated.View
            style={[
              {
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_SIZE / 2,
                backgroundColor: '#ffffff',
                position: 'absolute',
                top: THUMB_MARGIN,
                ...theme.shadows.sm,
              },
              thumbStyle,
            ]}
          />
        </Animated.View>
      </ToggleRow>
    </Pressable>
  );
}
