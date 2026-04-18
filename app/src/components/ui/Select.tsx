import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, X, Check } from 'lucide-react-native';
import { ICON_SIZES, useIconColors } from '../../constants/icons';
import { useTheme } from 'styled-components/native';
import { HIT_SLOP_SM } from '../../constants/hitSlop';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  style?: any;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  label,
  error,
  disabled = false,
  style: containerStyle,
}: SelectProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const iconColors = useIconColors();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setIsOpen(false);
  };

  return (
    <View style={containerStyle}>
      {label && (
        <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{label}</Text>
      )}
      <Pressable
        onPress={() => !disabled && setIsOpen(true)}
        style={{
          backgroundColor: colors.card,
          padding: 16,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: disabled ? 0.5 : 1,
          borderWidth: error ? 1 : 0,
          borderColor: error ? colors.danger : undefined,
        }}
      >
        <Text style={{ color: selectedOption ? colors.foreground : colors.mutedForeground }}>
          {selectedOption?.label || placeholder}
        </Text>
        <ChevronDown size={ICON_SIZES.md} color={iconColors.muted} />
      </Pressable>
      {error && (
        <Text style={{ color: colors.danger, fontSize: 14, marginTop: 4 }}>{error}</Text>
      )}

      <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
              {label || 'Select'}
            </Text>
            <Pressable onPress={() => setIsOpen(false)} hitSlop={HIT_SLOP_SM} style={{ padding: 8 }}>
              <X size={ICON_SIZES.default} color={iconColors.muted} />
            </Pressable>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  onPress={() => handleSelect(item.value)}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isSelected ? colors.accent : colors.card,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? colors.accentForeground : colors.foreground,
                      fontFamily: isSelected ? 'Inter_600SemiBold' : undefined,
                    }}
                  >
                    {item.label}
                  </Text>
                  {isSelected && <Check size={ICON_SIZES.md} color={colors.primaryForeground} />}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
