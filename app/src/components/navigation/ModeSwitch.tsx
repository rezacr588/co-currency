import { useMemo, useState } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useTheme } from 'styled-components/native';
import { AppMode, getModeFromPath, switchAppMode } from '../../navigation/mode';

interface ModeSwitchProps {
  disabled?: boolean;
  style?: ViewStyle;
}

export function ModeSwitch({ disabled = false, style }: ModeSwitchProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const pathname = usePathname();
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);

  const activeMode = useMemo<AppMode>(() => {
    return getModeFromPath(pathname) ?? 'finapp';
  }, [pathname]);

  const handleSwitch = async (targetMode: AppMode) => {
    if (disabled || isSwitching || targetMode === activeMode) {
      return;
    }

    try {
      setIsSwitching(true);
      await switchAppMode(router, targetMode, pathname || undefined);
    } finally {
      setIsSwitching(false);
    }
  };

  const renderOption = (mode: AppMode, label: string) => {
    const isActive = activeMode === mode;
    return (
      <Pressable
        key={mode}
        onPress={() => {
          void handleSwitch(mode);
        }}
        disabled={disabled || isSwitching}
        style={({ pressed }) => [
          {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            paddingVertical: 8,
            paddingHorizontal: 12,
            minHeight: 36,
            backgroundColor: isActive ? colors.foreground : 'transparent',
            opacity: disabled || isSwitching ? 0.6 : pressed ? 0.78 : 1,
          },
        ]}
      >
        <Text
          style={{
            color: isActive ? colors.background : colors.foreground,
            fontSize: 12,
            fontFamily: isActive ? 'Inter_700Bold' : 'Inter_500Medium',
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 4,
          gap: 4,
        },
        style,
      ]}
    >
      {renderOption('finapp', 'FinApp')}
      {renderOption('todo', 'Todo')}
    </View>
  );
}
