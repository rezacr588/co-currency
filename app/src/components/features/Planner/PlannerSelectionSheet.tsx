import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, Search, X } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';

export interface PlannerSelectionOption {
  value: string;
  label: string;
  description?: string;
}

interface PlannerSelectionSheetProps {
  visible: boolean;
  title: string;
  options: PlannerSelectionOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClose: () => void;
  multiple?: boolean;
  searchPlaceholder?: string;
  closeOnSelect?: boolean;
}

export function PlannerSelectionSheet({
  visible,
  title,
  options,
  selectedValues,
  onToggle,
  onClose,
  multiple = false,
  searchPlaceholder = 'Search',
  closeOnSelect = !multiple,
}: PlannerSelectionSheetProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (!visible) {
      setSearchText('');
    }
  }, [visible]);

  const filteredOptions = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return options;
    }

    return options.filter((option) => {
      return (
        option.label.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query)
      );
    });
  }, [options, searchText]);

  const handlePress = (value: string) => {
    onToggle(value);
    if (closeOnSelect) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontFamily: 'Inter_700Bold',
              flex: 1,
            }}
          >
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('a11yClose') || 'Close'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <X size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={{ padding: 16, paddingBottom: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: colors.card,
            }}
          >
            <Search size={15} color={colors.mutedForeground} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.placeholder}
              style={{ flex: 1, color: colors.foreground, fontSize: 14 }}
            />
            {searchText ? (
              <Pressable
                onPress={() => setSearchText('')}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('a11yClearFilter') || 'Clear search'}
              >
                <X size={14} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <FlatList
          data={filteredOptions}
          keyExtractor={(item) => item.value}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const selected = selectedValues.includes(item.value);
            return (
              <Pressable
                onPress={() => handlePress(item.value)}
                accessibilityRole={multiple ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: selected }}
                accessibilityLabel={item.label}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? theme.alpha(colors.accent, 0.08) : colors.card,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                  },
                  pressed && { opacity: 0.78 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: selected ? colors.accent : colors.foreground,
                      fontSize: 14,
                      fontFamily: selected ? 'Inter_700Bold' : 'Inter_500Medium',
                    }}
                  >
                    {item.label}
                  </Text>
                  {item.description ? (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? colors.accent : colors.muted,
                    borderWidth: selected ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  {selected ? (
                    <Check size={14} color={colors.accentForeground} />
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.card,
                padding: 18,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {t('plannerNoMatchesFound') || 'No matches found.'}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
