import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';
import { haptics } from '../../../utils/haptics';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  initialDate?: string;
  title?: string;
}

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseInitialDate(value?: string): { year: number; month: number; day: number } {
  if (value) {
    const [y, m, d] = value.split('-').map(Number);
    if (y && m && d) return { year: y, month: m, day: d };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function DatePickerModal({ visible, onClose, onSelect, initialDate, title }: DatePickerModalProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const initial = useMemo(() => parseInitialDate(initialDate), [initialDate]);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear; y <= currentYear + 5; y++) list.push(y);
    return list;
  }, [currentYear]);

  const maxDay = useMemo(() => daysInMonth(year, month), [year, month]);
  const clampedDay = Math.min(day, maxDay);

  const days = useMemo(() => {
    const list: number[] = [];
    for (let d = 1; d <= maxDay; d++) list.push(d);
    return list;
  }, [maxDay]);

  const handleYearChange = useCallback((y: number) => {
    setYear(y);
    void haptics.selection();
  }, []);

  const handleMonthChange = useCallback((m: number) => {
    setMonth(m);
    void haptics.selection();
  }, []);

  const handleDayChange = useCallback((d: number) => {
    setDay(d);
    void haptics.selection();
  }, []);

  const handleConfirm = useCallback(() => {
    const formatted = `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    void haptics.success();
    onSelect(formatted);
    onClose();
  }, [year, month, clampedDay, onSelect, onClose]);

  const handleClear = useCallback(() => {
    void haptics.light();
    onSelect('');
    onClose();
  }, [onSelect, onClose]);

  const chipStyle = (selected: boolean) => ({
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: selected ? colors.accent : colors.border,
    backgroundColor: selected ? colors.accent + '22' : colors.card,
    marginRight: 8,
    marginBottom: 8,
  });

  const chipTextStyle = (selected: boolean) => ({
    color: selected ? colors.accent : colors.foreground,
    fontSize: 13,
    fontFamily: selected ? ('Inter_700Bold' as const) : ('Inter_500Medium' as const),
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View
          style={{
            maxHeight: '80%',
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: Math.max(insets.bottom + 12, 20),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 17 }}>
              {title || t('plannerSelectDate') || 'Select Date'}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {t('plannerClose') || 'Close'}
              </Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, fontFamily: 'Inter_600SemiBold' }}>
              Year
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row' }}>
                {years.map((y) => (
                  <Pressable key={y} onPress={() => handleYearChange(y)}>
                    <View style={chipStyle(year === y)}>
                      <Text style={chipTextStyle(year === y)}>{y}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, fontFamily: 'Inter_600SemiBold' }}>
              Month
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {MONTH_NAMES_EN.map((name, idx) => (
                <Pressable key={idx} onPress={() => handleMonthChange(idx + 1)}>
                  <View style={chipStyle(month === idx + 1)}>
                    <Text style={chipTextStyle(month === idx + 1)}>{name.slice(0, 3)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, fontFamily: 'Inter_600SemiBold' }}>
              Day
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {days.map((d) => (
                <Pressable key={d} onPress={() => handleDayChange(d)}>
                  <View style={chipStyle(clampedDay === d)}>
                    <Text style={chipTextStyle(clampedDay === d)}>{d}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => [{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
              }, pressed && { opacity: 0.72 }]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                {t('plannerClear') || 'Clear'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [{
                flex: 1,
                borderRadius: 12,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                shadowColor: colors.accent,
                shadowOpacity: 0.34,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 0 },
              }, pressed && { opacity: 0.78 }]}
            >
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold' }}>
                {t('plannerConfirm') || 'Confirm'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
