import { Modal, Pressable, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';
import { COLUMN_ORDER, getStatusLabel } from '../../../utils/plannerConstants';
import type { PlannerStatus, TodoItem } from '../../../types/planner';

interface PlannerStatusSheetProps {
  visible: boolean;
  task: TodoItem | null;
  onClose: () => void;
  onSelect: (status: PlannerStatus) => void;
}

export function PlannerStatusSheet({
  visible,
  task,
  onClose,
  onSelect,
}: PlannerStatusSheetProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 26,
            gap: 12,
          }}
        >
          <View style={{ alignItems: 'center', paddingBottom: 4 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontFamily: 'Inter_700Bold',
                }}
              >
                {t('plannerMoveTo') || 'Move to'}
              </Text>
              {task ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>
                  {task.title}
                </Text>
              ) : null}
            </View>
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

          {COLUMN_ORDER.map((status) => {
            const selected = task?.status === status;
            return (
              <Pressable
                key={status}
                onPress={() => {
                  if (!selected) {
                    onSelect(status);
                  }
                }}
                disabled={selected}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: selected }}
                accessibilityLabel={getStatusLabel(status, t as (key: string) => string | undefined)}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? theme.alpha(colors.accent, 0.08) : colors.card,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    opacity: selected ? 0.7 : 1,
                  },
                  pressed && !selected ? { opacity: 0.78 } : null,
                ]}
              >
                <Text
                  style={{
                    color: selected ? colors.accent : colors.foreground,
                    fontSize: 14,
                    fontFamily: selected ? 'Inter_700Bold' : 'Inter_500Medium',
                  }}
                >
                  {getStatusLabel(status, t as (key: string) => string | undefined)}
                </Text>
                {selected ? <Check size={16} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}
