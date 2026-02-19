import { View, Text, Pressable } from 'react-native';
import { Pin } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import type { Note } from '../../../types/note';

// Color mapping for note backgrounds and borders
const COLOR_STYLES: Record<string, { bg: string; border: string }> = {
  default: { bg: 'transparent', border: 'transparent' },
  red: { bg: '#ef44441a', border: '#ef44444d' },
  orange: { bg: '#f973161a', border: '#f973164d' },
  yellow: { bg: '#eab3081a', border: '#eab3084d' },
  green: { bg: '#22c55e1a', border: '#22c55e4d' },
  blue: { bg: '#3b82f61a', border: '#3b82f64d' },
  purple: { bg: '#a855f71a', border: '#a855f74d' },
  pink: { bg: '#ec48991a', border: '#ec48994d' },
};

interface NoteCardProps {
  note: Note;
  onPress: (note: Note) => void;
  onLongPress?: (note: Note) => void;
}

export function NoteCard({ note, onPress, onLongPress }: NoteCardProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const colorStyle = COLOR_STYLES[note.color] || COLOR_STYLES.default;

  return (
    <Pressable
      onPress={() => onPress(note)}
      onLongPress={() => onLongPress?.(note)}
      delayLongPress={500}
      style={({ pressed }) => ({
        cursor: 'pointer',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: colorStyle.bg === 'transparent' ? colors.card : colorStyle.bg,
        borderColor: colorStyle.border === 'transparent' ? colors.border : colorStyle.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* Pin indicator */}
      {note.is_pinned && (
        <View style={{ position: 'absolute', top: 8, right: 8 }}>
          <Pin size={14} color="rgb(212, 175, 55)" fill="rgb(212, 175, 55)" />
        </View>
      )}

      {/* Title */}
      <Text
        style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}
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
      <Text style={{ color: colors.mutedForeground + '99', fontSize: 12, marginTop: 12 }}>
        {new Date(note.updated_at).toLocaleDateString()}
      </Text>
    </Pressable>
  );
}
