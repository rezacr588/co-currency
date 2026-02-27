import { Pressable, View, Text } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { readStorage, writeStorage } from '../../utils/storage';

interface CollapsibleSectionProps {
  title: string;
  storageKey?: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

const STORAGE_PREFIX = 'collapsible_';

export function CollapsibleSection({
  title,
  storageKey,
  defaultCollapsed = false,
  children,
}: CollapsibleSectionProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [initialized, setInitialized] = useState(!storageKey);
  const rotation = useSharedValue(defaultCollapsed ? -90 : 0);
  const opacity = useSharedValue(defaultCollapsed ? 0 : 1);

  useEffect(() => {
    if (storageKey) {
      readStorage(`${STORAGE_PREFIX}${storageKey}`).then((val) => {
        if (val !== null) {
          const isCollapsed = val === 'true';
          setCollapsed(isCollapsed);
          rotation.value = isCollapsed ? -90 : 0;
          opacity.value = isCollapsed ? 0 : 1;
        }
        setInitialized(true);
      }).catch(() => {
        setInitialized(true);
      });
    }
  }, [storageKey, rotation, opacity]);

  const toggle = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    rotation.value = withTiming(next ? -90 : 0, { duration: 200 });
    opacity.value = withTiming(next ? 0 : 1, { duration: 200 });
    if (storageKey) {
      writeStorage(`${STORAGE_PREFIX}${storageKey}`, String(next));
    }
  }, [collapsed, storageKey, rotation, opacity]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    overflow: 'hidden' as const,
    maxHeight: opacity.value === 0 ? 0 : 9999,
  }));

  if (!initialized) return null;

  return (
    <View>
      <Pressable
        onPress={toggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
          minHeight: 44,
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={`${title}, ${collapsed ? 'collapsed' : 'expanded'}`}
      >
        <Text
          style={{
            color: colors.foreground,
            fontSize: 16,
            fontFamily: 'Inter_600SemiBold',
          }}
        >
          {title}
        </Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={18} color={colors.mutedForeground} />
        </Animated.View>
      </Pressable>
      <Animated.View style={contentStyle}>{children}</Animated.View>
    </View>
  );
}
