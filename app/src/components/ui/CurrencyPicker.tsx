import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Search, Check } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { getCurrencyDisplay } from '../../utils/format';
import { LoadingSpinner } from './LoadingSpinner';
import { ICON_SIZES, ICON_COLOR_MUTED } from '../../constants/icons';

interface CurrencyPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (currency: string) => void;
  selectedCurrency?: string;
  title?: string;
}

export function CurrencyPicker({
  visible,
  onClose,
  onSelect,
  selectedCurrency,
  title = 'Select Currency',
}: CurrencyPickerProps) {
  const [search, setSearch] = useState('');

  const { data: currencies, isPending } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.currencies.list(),
    enabled: visible,
  });

  const filteredCurrencies = currencies?.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (code: string) => {
    onSelect(code);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Text className="text-xl font-bold text-foreground">{title}</Text>
          <Pressable onPress={onClose} className="p-2">
            <X size={ICON_SIZES.default} color={ICON_COLOR_MUTED} />
          </Pressable>
        </View>

        {/* Search */}
        <View className="p-4">
          <View className="bg-card rounded-xl flex-row items-center px-4">
            <Search size={ICON_SIZES.md} color={ICON_COLOR_MUTED} />
            <TextInput
              className="flex-1 py-3 px-3 text-foreground"
              placeholder="Search currency..."
              placeholderTextColor="rgb(148, 163, 184)"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Currency List */}
        {isPending ? (
          <LoadingSpinner />
        ) : (
          <FlatList
            data={filteredCurrencies}
            keyExtractor={(item) => item.code}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            renderItem={({ item }) => {
              const display = getCurrencyDisplay(item.code);
              const isSelected = item.code === selectedCurrency;

              return (
                <Pressable
                  onPress={() => handleSelect(item.code)}
                  className={`p-4 rounded-xl flex-row items-center ${
                    isSelected ? 'bg-accent' : 'bg-card'
                  }`}
                >
                  <Text className="text-2xl mr-3">{display.flag || '🌐'}</Text>
                  <View className="flex-1">
                    <Text
                      className={`font-semibold ${
                        isSelected ? 'text-accent-foreground' : 'text-foreground'
                      }`}
                    >
                      {item.code}
                    </Text>
                    <Text
                      className={`text-sm ${
                        isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground'
                      }`}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <Text
                    className={`mr-2 ${
                      isSelected ? 'text-accent-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {display.symbol}
                  </Text>
                  {isSelected && <Check size={ICON_SIZES.md} color="rgb(15, 26, 42)" />}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-8">
                <Text className="text-muted-foreground">No currencies found</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
