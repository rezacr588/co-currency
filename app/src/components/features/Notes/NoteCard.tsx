import { View, Text, Pressable } from 'react-native';
import { Pin } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { spacing, radii } from '../../../theme';
import type { Note } from '../../../types/note';

type NoteColorStyle = { bg: string; border: string };

function useNoteCardColorStyles(): Record<string, NoteColorStyle> {
  const theme = useTheme();
  const { colors, alpha } = theme;
  return {
    default: { bg: colors.card, border: colors.border },
    red: { bg: alpha(colors.palette.red, 0.1), border: alpha(colors.palette.red, 0.3) },
    orange: { bg: alpha(colors.palette.orange, 0.1), border: alpha(colors.palette.orange, 0.3) },
    yellow: { bg: alpha(colors.palette.yellow, 0.1), border: alpha(colors.palette.yellow, 0.3) },
    green: { bg: alpha(colors.palette.green, 0.1), border: alpha(colors.palette.green, 0.3) },
    blue: { bg: alpha(colors.palette.blue, 0.1), border: alpha(colors.palette.blue, 0.3) },
    purple: { bg: alpha(colors.palette.purple, 0.1), border: alpha(colors.palette.purple, 0.3) },
    pink: { bg: alpha(colors.palette.pink, 0.1), border: alpha(colors.palette.pink, 0.3) },
  };
}

interface NoteCardProps {
  note: Note;
  onPress: (note: Note) => void;
  onLongPress?: (note: Note) => void;
}

export function NoteCard({ note, onPress, onLongPress }: NoteCardProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const colorStyles = useNoteCardColorStyles();
  const colorStyle = colorStyles[note.color] ?? colorStyles.default;

  return (
    <Pressable
      onPress={() => onPress(note)}
      onLongPress={() => onLongPress?.(note)}
      delayLongPress={500}
      style={({ pressed }) => ({
        cursor: 'pointer',
        padding: spacing.lg,
        borderRadius: radii.md,
        borderWidth: 1,
        backgroundColor: colorStyle.bg,
        borderColor: colorStyle.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* Pin indicator */}
      {note.is_pinned && (
        <View style={{ position: 'absolute', top: spacing.sm, right: spacing.sm }}>
          <Pin size={14} color={colors.accent} fill={colors.accent} />
        </View>
      )}

      {/* Title */}
      <Text
        style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: spacing.sm }}
        numberOfLines={2}
      >
        {note.title}
      </Text>

      {/* Content preview */}
      {note.content && (
        <Text
          style={{ color: colors.mutedForeground, fontSize: 14 }}
          numberOfLines={4}
        >
          {note.content}
        </Text>
      )}

      {/* Date */}
      <Text style={{ color: theme.alpha(colors.mutedForeground, 0.6), fontSize: 12, marginTop: spacing.md }}>
        {new Date(note.updated_at).toLocaleDateString()}
      </Text>
    </Pressable>
  );
}
