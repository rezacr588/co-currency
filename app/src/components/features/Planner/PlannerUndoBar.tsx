import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from 'styled-components/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../../context/LanguageContext';

export interface PlannerUndoBarProps {
  onUndo: () => void;
}

export const PlannerUndoBar = memo(function PlannerUndoBar({
  onUndo,
}: PlannerUndoBarProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={`${t('plannerTaskCompleted') || 'Task completed'}. ${t('plannerUndo') || 'Undo'}`}
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom + 8, 20),
        left: 16,
        right: 16,
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    >
      <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
        {t('plannerTaskCompleted') || 'Task completed'}
      </Text>
      <Pressable
        onPress={onUndo}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('plannerUndo') || 'Undo'}
        style={{ minHeight: 36, justifyContent: 'center' }}
      >
        <Text style={{ color: colors.accent, fontSize: 13, fontFamily: 'Inter_700Bold' }}>
          {t('plannerUndo') || 'Undo'}
        </Text>
      </Pressable>
    </View>
  );
});
