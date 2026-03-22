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
import { HIT_SLOP_SM } from '../../constants/hitSlop';
import { ICON_SIZES, ICON_COLOR_MUTED } from '../../constants/icons';
import { haptics } from '../../utils/haptics';
import { useTheme } from 'styled-components/native';

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
  const theme = useTheme();
  const colors = theme.colors;
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
    haptics.selection();
    onSelect(code);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={HIT_SLOP_SM} style={{ padding: 8 }}>
            <X size={ICON_SIZES.default} color={ICON_COLOR_MUTED} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={{ padding: 16 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
            <Search size={ICON_SIZES.md} color={ICON_COLOR_MUTED} />
            <TextInput
              style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, color: colors.foreground }}
              placeholder="Search currency..."
              placeholderTextColor={colors.placeholder}
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
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => {
              const display = getCurrencyDisplay(item.code);
              const isSelected = item.code === selectedCurrency;

              return (
                <Pressable
                  onPress={() => handleSelect(item.code)}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSelected ? colors.accent : colors.card,
                  }}
                >
                  <Text style={{ fontSize: 24, marginEnd: 12 }}>{display.flag || '🌐'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: 'Inter_600SemiBold',
                        color: isSelected ? colors.accentForeground : colors.foreground,
                      }}
                    >
                      {item.code}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        color: isSelected ? colors.accentForeground + 'b3' : colors.mutedForeground,
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <Text
                    style={{
                      marginEnd: 8,
                      color: isSelected ? colors.accentForeground : colors.mutedForeground,
                    }}
                  >
                    {display.symbol}
                  </Text>
                  {isSelected && <Check size={ICON_SIZES.md} color={colors.primaryForeground} />}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ color: colors.mutedForeground }}>No currencies found</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
