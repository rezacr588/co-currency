import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';
import { haptics } from '../../../utils/haptics';
import {
  getLocalizedMonthNames,
  getLocalizedMonthShortNames,
} from '../../../utils/plannerConstants';
import {
  normalizePlannerDueDate,
  plannerDueDateToDate,
} from '../../../utils/plannerDate';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  initialDate?: string;
  title?: string;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseInitialDate(value?: string): { year: number; month: number; day: number } {
  const normalized = normalizePlannerDueDate(value);
  if (normalized) {
    const [y, m, d] = normalized.split('-').map(Number);
    if (y && m && d) return { year: y, month: m, day: d };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function formatDateForPlanner(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePickerModal({
  visible,
  onClose,
  onSelect,
  initialDate,
  title,
}: DatePickerModalProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const initial = useMemo(() => parseInitialDate(initialDate), [initialDate]);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const [nativeDate, setNativeDate] = useState(() => plannerDueDateToDate(initialDate));

  useEffect(() => {
    if (!visible) {
      return;
    }
    const next = parseInitialDate(initialDate);
    setYear(next.year);
    setMonth(next.month);
    setDay(next.day);
    setNativeDate(plannerDueDateToDate(initialDate));
  }, [initialDate, visible]);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 10; y++) list.push(y);
    return list;
  }, [currentYear]);

  const maxDay = useMemo(() => daysInMonth(year, month), [year, month]);
  const clampedDay = Math.min(day, maxDay);

  const days = useMemo(() => {
    const list: number[] = [];
    for (let d = 1; d <= maxDay; d++) list.push(d);
    return list;
  }, [maxDay]);

  const monthNames = useMemo(
    () => getLocalizedMonthNames(t as (key: string) => string | undefined),
    [t]
  );
  const monthShortNames = useMemo(
    () => getLocalizedMonthShortNames(t as (key: string) => string | undefined),
    [t]
  );

  const handleYearChange = useCallback((value: number) => {
    setYear(value);
    void haptics.selection();
  }, []);

  const handleMonthChange = useCallback((value: number) => {
    setMonth(value);
    void haptics.selection();
  }, []);

  const handleDayChange = useCallback((value: number) => {
    setDay(value);
    void haptics.selection();
  }, []);

  const handleClear = useCallback(() => {
    void haptics.light();
    onSelect('');
    onClose();
  }, [onClose, onSelect]);

  const handleNativeChange = useCallback(
    (event: DateTimePickerEvent, value?: Date) => {
      if (Platform.OS === 'android') {
        if (event.type === 'dismissed') {
          onClose();
          return;
        }

        if (value) {
          void haptics.success();
          onSelect(formatDateForPlanner(value));
        }
        onClose();
        return;
      }

      if (value) {
        setNativeDate(value);
      }
    },
    [onClose, onSelect]
  );

  useEffect(() => {
    if (!visible || Platform.OS !== 'android') {
      return;
    }

    DateTimePickerAndroid.open({
      mode: 'date',
      value: nativeDate,
      onChange: handleNativeChange,
    });
  }, [handleNativeChange, nativeDate, visible]);

  const handleConfirm = useCallback(() => {
    if (Platform.OS === 'web') {
      const formatted = `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
      void haptics.success();
      onSelect(formatted);
      onClose();
      return;
    }

    void haptics.success();
    onSelect(formatDateForPlanner(nativeDate));
    onClose();
  }, [clampedDay, month, nativeDate, onClose, onSelect, year]);

  if (Platform.OS === 'android') {
    return null;
  }

  const chipStyle = (selected: boolean) => ({
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: selected ? colors.accent : colors.border,
    backgroundColor: selected ? colors.accent + '22' : colors.card,
    marginEnd: 8,
    marginBottom: 8,
    minHeight: 40,
    justifyContent: 'center' as const,
  });

  const chipTextStyle = (selected: boolean) => ({
    color: selected ? colors.accent : colors.foreground,
    fontSize: 13,
    fontFamily: selected ? ('Inter_700Bold' as const) : ('Inter_500Medium' as const),
  });

  const normalizedNativeDate = formatDateForPlanner(nativeDate);
  const nativeMonthName = monthNames[nativeDate.getMonth()];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View
          style={{
            maxHeight: '82%',
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
          <View style={{ alignItems: 'center', paddingBottom: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>
              {title || t('plannerSelectDate') || 'Select Date'}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: colors.muted,
                },
                pressed && { opacity: 0.72 },
              ]}
            >
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 13,
                  fontFamily: 'Inter_500Medium',
                }}
              >
                {t('plannerClose') || 'Close'}
              </Text>
            </Pressable>
          </View>

          {Platform.OS === 'web' ? (
            <>
              <View
                style={{
                  backgroundColor: colors.accent + '14',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.accent + '33',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginBottom: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.accent, fontSize: 16, fontFamily: 'Inter_700Bold' }}>
                  {`${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`}
                </Text>
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: 12,
                    fontFamily: 'Inter_500Medium',
                    marginTop: 2,
                    opacity: 0.8,
                  }}
                >
                  {monthNames[month - 1]} {clampedDay}, {year}
                </Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerYear') || 'Year'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {years.map((value) => (
                      <Pressable key={value} onPress={() => handleYearChange(value)}>
                        <View style={chipStyle(year === value)}>
                          <Text style={chipTextStyle(year === value)}>{value}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerMonth') || 'Month'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
                  {monthShortNames.map((name, index) => (
                    <Pressable key={name} onPress={() => handleMonthChange(index + 1)}>
                      <View style={chipStyle(month === index + 1)}>
                        <Text style={chipTextStyle(month === index + 1)}>{name}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerDay') || 'Day'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
                  {days.map((value) => (
                    <Pressable key={value} onPress={() => handleDayChange(value)}>
                      <View style={chipStyle(clampedDay === value)}>
                        <Text style={chipTextStyle(clampedDay === value)}>{value}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </>
          ) : (
            <View>
              <View
                style={{
                  backgroundColor: colors.accent + '14',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.accent + '33',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginBottom: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.accent, fontSize: 16, fontFamily: 'Inter_700Bold' }}>
                  {normalizedNativeDate}
                </Text>
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: 12,
                    fontFamily: 'Inter_500Medium',
                    marginTop: 2,
                    opacity: 0.8,
                  }}
                >
                  {nativeMonthName} {nativeDate.getDate()}, {nativeDate.getFullYear()}
                </Text>
              </View>

              <DateTimePicker
                value={nativeDate}
                mode="date"
                display="spinner"
                onChange={handleNativeChange}
                themeVariant={theme.isDark ? 'dark' : 'light'}
                style={{ alignSelf: 'center' }}
              />
            </View>
          )}

          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 14, marginBottom: 12 }} />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => [
                {
                  flex: 1,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 14,
                },
                pressed && { opacity: 0.72 },
              ]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
                {t('plannerClear') || 'Clear'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                {
                  flex: 1.5,
                  borderRadius: 12,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 14,
                  shadowColor: colors.accent,
                  shadowOpacity: 0.34,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 4,
                },
                pressed && { opacity: 0.78 },
              ]}
            >
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
                {t('plannerConfirm') || 'Confirm'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
