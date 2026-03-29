import { memo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, TrendingDown, TrendingUp, X } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';
import { CategoryIcon, CATEGORY_ICONS } from '../../../constants/icons';
import { getCurrencyDisplay } from '../../../utils/format';
import { COMMON_CURRENCIES } from '../../../constants/currencies';

const CATEGORIES = Object.keys(CATEGORY_ICONS);
const CURRENCIES = [...COMMON_CURRENCIES];

export interface HistoryEditModalProps {
  visible: boolean;
  onClose: () => void;
  editType: 'credit' | 'debit';
  setEditType: (type: 'credit' | 'debit') => void;
  editAmount: string;
  setEditAmount: (amount: string) => void;
  editCurrency: string;
  setEditCurrency: (currency: string) => void;
  editCategory: string;
  setEditCategory: (category: string) => void;
  editDescription: string;
  setEditDescription: (description: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const HistoryEditModal = memo(function HistoryEditModal({
  visible,
  onClose,
  editType,
  setEditType,
  editAmount,
  setEditAmount,
  editCurrency,
  setEditCurrency,
  editCategory,
  setEditCategory,
  editDescription,
  setEditDescription,
  onSave,
  isSaving,
}: HistoryEditModalProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={onClose}
        >
          <Pressable
            style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}
            onPress={(e) => e.stopPropagation()}
          >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('editTransaction')}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [{ padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('close') || 'Close'} accessibilityRole="button">
              <X size={24} color={colors.placeholder} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
          >
            {/* Transaction Type */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('transactionType')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setEditType('debit')}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    backgroundColor: editType === 'debit' ? colors.foreground : colors.card,
                    borderColor: editType === 'debit' ? colors.foreground : colors.border,
                    cursor: 'pointer',
                  }}
                >
                  <TrendingDown size={18} color={editType === 'debit' ? colors.primaryForeground : colors.danger} />
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      marginStart: 8,
                      fontSize: 14,
                      color: editType === 'debit' ? colors.background : colors.foreground,
                    }}
                  >
                    {t('expenses')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setEditType('credit')}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    backgroundColor: editType === 'credit' ? colors.foreground : colors.card,
                    borderColor: editType === 'credit' ? colors.foreground : colors.border,
                    cursor: 'pointer',
                  }}
                >
                  <TrendingUp size={18} color={editType === 'credit' ? colors.primaryForeground : colors.success} />
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      marginStart: 8,
                      fontSize: 14,
                      color: editType === 'credit' ? colors.background : colors.foreground,
                    }}
                  >
                    {t('income')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Amount */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('amount')}</Text>
              <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                <Text style={{ fontSize: 20, color: colors.mutedForeground, marginEnd: 8 }}>
                  {getCurrencyDisplay(editCurrency).symbol}
                </Text>
                <TextInput
                  style={{ flex: 1, padding: 14, fontSize: 20, fontFamily: 'Inter_600SemiBold', color: colors.foreground, outlineStyle: 'none' } as any}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.subtleForeground}
                />
              </View>
            </View>

            {/* Currency */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('currency')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {CURRENCIES.map((code) => {
                    const display = getCurrencyDisplay(code);
                    return (
                      <Pressable
                        key={code}
                        onPress={() => setEditCurrency(code)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderWidth: 1,
                          backgroundColor: editCurrency === code ? colors.foreground : colors.secondary,
                          borderColor: editCurrency === code ? colors.foreground : colors.border,
                          cursor: 'pointer',
                          minHeight: 44,
                        }}
                      >
                        <Text style={{ marginEnd: 4, fontSize: 14 }}>{display.flag || ''}</Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: editCurrency === code ? colors.background : colors.foreground,
                            fontFamily: editCurrency === code ? 'Inter_500Medium' : undefined,
                          }}
                        >
                          {code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Category */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('category')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map((cat) => {
                  const isSelected = editCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setEditCategory(cat)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        borderWidth: 1,
                        backgroundColor: isSelected ? colors.foreground : colors.secondary,
                        borderColor: isSelected ? colors.foreground : colors.border,
                        cursor: 'pointer',
                        minHeight: 44,
                      }}
                    >
                      <CategoryIcon
                        category={cat}
                        size={14}
                        color={isSelected ? colors.primaryForeground : colors.secondaryForeground}
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          color: isSelected ? colors.background : colors.foreground,
                          fontFamily: isSelected ? 'Inter_500Medium' : undefined,
                        }}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Description */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('description')}</Text>
              <TextInput
                style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, outlineStyle: 'none' } as any}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder={t('descriptionPlaceholder')}
                placeholderTextColor={colors.subtleForeground}
                multiline
              />
            </View>

            {/* Save Button */}
            <Pressable
              onPress={onSave}
              disabled={isSaving}
              style={{
                backgroundColor: colors.accent,
                padding: 14,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isSaving ? 0.5 : 1,
                cursor: 'pointer',
              }}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Check size={18} color={colors.primaryForeground} />
                  <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', marginStart: 8 }}>
                    {t('saveChanges')}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
});
