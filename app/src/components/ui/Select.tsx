import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, X, Check } from 'lucide-react-native';

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
  className?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  label,
  error,
  disabled = false,
  className = '',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setIsOpen(false);
  };

  return (
    <View className={className}>
      {label && (
        <Text className="text-muted-foreground mb-2">{label}</Text>
      )}
      <Pressable
        onPress={() => !disabled && setIsOpen(true)}
        className={`bg-card p-4 rounded-xl flex-row items-center justify-between ${
          disabled ? 'opacity-50' : ''
        } ${error ? 'border border-danger' : ''}`}
      >
        <Text className={selectedOption ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedOption?.label || placeholder}
        </Text>
        <ChevronDown size={20} color="rgb(148, 163, 184)" />
      </Pressable>
      {error && (
        <Text className="text-danger text-sm mt-1">{error}</Text>
      )}

      <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-background">
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-xl font-bold text-foreground">
              {label || 'Select'}
            </Text>
            <Pressable onPress={() => setIsOpen(false)} className="p-2">
              <X size={24} color="rgb(148, 163, 184)" />
            </Pressable>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  onPress={() => handleSelect(item.value)}
                  className={`p-4 rounded-xl flex-row items-center justify-between ${
                    isSelected ? 'bg-accent' : 'bg-card'
                  }`}
                >
                  <Text
                    className={
                      isSelected ? 'text-accent-foreground font-semibold' : 'text-foreground'
                    }
                  >
                    {item.label}
                  </Text>
                  {isSelected && <Check size={20} color="rgb(15, 26, 42)" />}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
