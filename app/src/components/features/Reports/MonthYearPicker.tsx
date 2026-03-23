import { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenLayout } from '../../../hooks/useScreenLayout';

interface MonthYearPickerProps {
  visible: boolean;
  onClose: () => void;
  selectedYear: number;
  selectedMonth: number;
  onSelect: (year: number, month: number) => void;
  monthLabels: string[];
  previousYearLabel: string;
  nextYearLabel: string;
  t: (key: string) => string;
  currentYear: number;
  currentMonth: number;
}

const PICKER_MAX_WIDTH = 384;
const PICKER_BASE_PADDING = 16;
const PICKER_MODAL_PADDING = 24;
const PICKER_MONTH_GAP = 8;
const PICKER_MONTH_TILE_RADIUS = 12;

export function MonthYearPicker({
  visible,
  onClose,
  selectedYear,
  selectedMonth,
  onSelect,
  monthLabels,
  previousYearLabel,
  nextYearLabel,
  t,
  currentYear,
  currentMonth,
}: MonthYearPickerProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const [viewYear, setViewYear] = useState(selectedYear);
  const { width, isCompactPhone } = useScreenLayout();
  const insets = useSafeAreaInsets();
  
  const modalScreenPadding = Math.max(PICKER_BASE_PADDING, Math.max(insets.left, insets.right) + PICKER_BASE_PADDING);
  const modalWidth = Math.min(width - modalScreenPadding * 2, PICKER_MAX_WIDTH);
  const modalInnerWidth = modalWidth - PICKER_MODAL_PADDING * 2;
  const monthCols = isCompactPhone ? 2 : 3;
  const monthGap = PICKER_MONTH_GAP;
  const monthTileWidth = (modalInnerWidth - monthGap * (monthCols - 1)) / monthCols;

  useEffect(() => {
    if (visible) {
      setViewYear(selectedYear);
    }
  }, [selectedYear, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: modalScreenPadding }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: colors.card, borderRadius: 16, padding: PICKER_MODAL_PADDING, width: modalWidth, maxWidth: PICKER_MAX_WIDTH }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Year selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Pressable
              onPress={() => setViewYear(viewYear - 1)}
              style={{ padding: 8, borderRadius: 8, backgroundColor: colors.secondary }}
              accessibilityRole="button"
              accessibilityLabel={previousYearLabel}
            >
              <ChevronLeft size={20} color={colors.secondaryForeground} />
            </Pressable>
            <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: 'Inter_700Bold' }}>{viewYear}</Text>
            <Pressable
              onPress={() => viewYear < currentYear && setViewYear(viewYear + 1)}
              style={{ padding: 8, borderRadius: 8, backgroundColor: viewYear >= currentYear ? 'transparent' : colors.secondary, opacity: viewYear >= currentYear ? 0.3 : 1 }}
              disabled={viewYear >= currentYear}
              accessibilityRole="button"
              accessibilityLabel={nextYearLabel}
            >
              <ChevronRight size={20} color={colors.secondaryForeground} />
            </Pressable>
          </View>

          {/* Month grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: PICKER_MONTH_GAP }}>
            {monthLabels.map((monthLabel, index) => {
              const monthNum = index + 1;
              const isSelected = selectedYear === viewYear && selectedMonth === monthNum;
              const isFuture = viewYear === currentYear && monthNum > currentMonth;
              const isCurrentMonth = viewYear === currentYear && monthNum === currentMonth;

              return (
                <Pressable
                  key={`${monthLabel}-${monthNum}`}
                  onPress={() => !isFuture && onSelect(viewYear, monthNum)}
                  disabled={isFuture}
                  style={{
                    width: monthTileWidth,
                    paddingVertical: 12,
                    borderRadius: PICKER_MONTH_TILE_RADIUS,
                    alignItems: 'center',
                    backgroundColor: isSelected
                      ? colors.primary
                      : isCurrentMonth
                        ? colors.primary + '18'
                        : isFuture
                          ? colors.secondary + '4D'
                          : colors.secondary,
                    borderWidth: isCurrentMonth && !isSelected ? 1 : 0,
                    borderColor: isCurrentMonth ? colors.primary : 'transparent',
                    opacity: isFuture ? 0.4 : 1,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={monthLabel}
                  accessibilityState={{ selected: isSelected, disabled: isFuture }}
                  accessibilityHint={isFuture ? 'Future month, not available' : `Select ${monthLabel} ${viewYear}`}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      color: isSelected ? colors.primaryForeground : isFuture ? colors.mutedForeground : colors.foreground,
                    }}
                  >
                    {monthLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={{ marginTop: 24, backgroundColor: colors.secondary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{t('close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
