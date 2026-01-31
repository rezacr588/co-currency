import { View, Text, Pressable } from 'react-native';
import { Pin } from 'lucide-react-native';
import type { Note } from '../../../types/note';

// Color mapping for note backgrounds and borders
const COLOR_STYLES: Record<string, { bg: string; border: string }> = {
  default: { bg: 'bg-card', border: 'border-border' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/30' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
};

interface NoteCardProps {
  note: Note;
  onPress: (note: Note) => void;
  onLongPress?: (note: Note) => void;
}

export function NoteCard({ note, onPress, onLongPress }: NoteCardProps) {
  const colorStyle = COLOR_STYLES[note.color] || COLOR_STYLES.default;

  return (
    <Pressable
      onPress={() => onPress(note)}
      onLongPress={() => onLongPress?.(note)}
      delayLongPress={500}
      style={{ cursor: 'pointer' }}
      className={`p-4 rounded-xl border ${colorStyle.bg} ${colorStyle.border} active:opacity-70`}
    >
      {/* Pin indicator */}
      {note.is_pinned && (
        <View className="absolute top-2 right-2">
          <Pin size={14} color="rgb(212, 175, 55)" fill="rgb(212, 175, 55)" />
        </View>
      )}

      {/* Title */}
      <Text
        className="text-foreground font-semibold mb-2"
        numberOfLines={2}
      >
        {note.title}
      </Text>

      {/* Content preview */}
      {note.content && (
        <Text
          className="text-muted-foreground text-sm"
          numberOfLines={4}
        >
          {note.content}
        </Text>
      )}

      {/* Date */}
      <Text className="text-muted-foreground/60 text-xs mt-3">
        {new Date(note.updated_at).toLocaleDateString()}
      </Text>
    </Pressable>
  );
}
