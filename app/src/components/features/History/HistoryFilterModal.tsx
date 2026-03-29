import { memo } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Calendar, TrendingDown, TrendingUp, X } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';
import { CategoryIcon, CATEGORY_ICONS } from '../../../constants/icons';

const CATEGORIES = Object.keys(CATEGORY_ICONS);

export interface HistoryFilterModalProps {
  visible: boolean;
  onClose: () => void;
  filterType: 'credit' | 'debit' | null;
  setFilterType: (type: 'credit' | 'debit' | null) => void;
  filterCategory: string | null;
  setFilterCategory: (category: string | null) => void;
  filterFromDate: string;
  setFilterFromDate: (date: string) => void;
  filterToDate: string;
  setFilterToDate: (date: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export const HistoryFilterModal = memo(function HistoryFilterModal({
  visible,
  onClose,
  filterType,
  setFilterType,
  filterCategory,
  setFilterCategory,
  filterFromDate,
  setFilterFromDate,
  filterToDate,
  setFilterToDate,
  onApply,
  onClear,
}: HistoryFilterModalProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('filters')}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [{ padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('close') || 'Close'} accessibilityRole="button">
              <X size={24} color={colors.placeholder} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
            {/* Type Filter */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('type')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setFilterType(null)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    backgroundColor: filterType === null ? colors.foreground : colors.secondary,
                    borderColor: filterType === null ? colors.foreground : colors.border,
                    cursor: 'pointer',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      fontSize: 14,
                      color: filterType === null ? colors.background : colors.foreground,
                    }}
                  >
                    {t('allTypes')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setFilterType('debit')}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    backgroundColor: filterType === 'debit' ? colors.foreground : colors.secondary,
                    borderColor: filterType === 'debit' ? colors.foreground : colors.border,
                    cursor: 'pointer',
                  }}
                >
                  <TrendingDown
                    size={16}
                    color={filterType === 'debit' ? colors.primaryForeground : colors.danger}
                  />
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      marginStart: 8,
                      fontSize: 14,
                      color: filterType === 'debit' ? colors.background : colors.foreground,
                    }}
                  >
                    {t('expenses')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setFilterType('credit')}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    backgroundColor: filterType === 'credit' ? colors.foreground : colors.secondary,
                    borderColor: filterType === 'credit' ? colors.foreground : colors.border,
                    cursor: 'pointer',
                  }}
                >
                  <TrendingUp
                    size={16}
                    color={filterType === 'credit' ? colors.primaryForeground : colors.success}
                  />
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      marginStart: 8,
                      fontSize: 14,
                      color: filterType === 'credit' ? colors.background : colors.foreground,
                    }}
                  >
                    {t('income')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Category Filter */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('category')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable
                  onPress={() => setFilterCategory(null)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 6,
                    borderWidth: 1,
                    backgroundColor: filterCategory === null ? colors.foreground : colors.secondary,
                    borderColor: filterCategory === null ? colors.foreground : colors.border,
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: filterCategory === null ? colors.background : colors.foreground,
                      fontFamily: filterCategory === null ? 'Inter_500Medium' : undefined,
                    }}
                  >
                    {t('allCategories')}
                  </Text>
                </Pressable>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setFilterCategory(cat)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      borderWidth: 1,
                      backgroundColor: filterCategory === cat ? colors.foreground : colors.secondary,
                      borderColor: filterCategory === cat ? colors.foreground : colors.border,
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    <CategoryIcon
                      category={cat}
                      size={14}
                      color={filterCategory === cat ? colors.primaryForeground : colors.secondaryForeground}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        color: filterCategory === cat ? colors.background : colors.foreground,
                        fontFamily: filterCategory === cat ? 'Inter_500Medium' : undefined,
                      }}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Date Range Filter */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('fromDate')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12 }}>
                <Calendar size={18} color={colors.mutedForeground} />
                <TextInput
                  style={{ flex: 1, padding: 12, color: colors.foreground, outlineStyle: 'none' } as any}
                  value={filterFromDate}
                  onChangeText={setFilterFromDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.subtleForeground}
                />
              </View>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('toDate')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12 }}>
                <Calendar size={18} color={colors.mutedForeground} />
                <TextInput
                  style={{ flex: 1, padding: 12, color: colors.foreground, outlineStyle: 'none' } as any}
                  value={filterToDate}
                  onChangeText={setFilterToDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.subtleForeground}
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={onClear}
                style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', cursor: 'pointer' }}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{t('clearFilters')}</Text>
              </Pressable>
              <Pressable
                onPress={onApply}
                style={{ flex: 1, backgroundColor: colors.accent, padding: 12, borderRadius: 8, alignItems: 'center', cursor: 'pointer' }}
              >
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium' }}>{t('filters')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
