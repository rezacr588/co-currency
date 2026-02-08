import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { X, Pin, Check } from 'lucide-react-native';
import type { Note, CreateNoteRequest, UpdateNoteRequest, NoteColor } from '../../../types/note';
import { NOTE_COLORS } from '../../../types/note';
import { useLanguage } from '../../../context/LanguageContext';
import { useColors } from '../../../context/ThemeContext';
import { Button } from '../../ui/Button';
import { Toggle } from '../../ui/Toggle';

// Color display mapping
const COLOR_DISPLAY: Record<string, { bg: string; name: string }> = {
  default: { bg: '#27272a', name: 'Default' },
  red: { bg: '#ef4444', name: 'Red' },
  orange: { bg: '#f97316', name: 'Orange' },
  yellow: { bg: '#eab308', name: 'Yellow' },
  green: { bg: '#22c55e', name: 'Green' },
  blue: { bg: '#3b82f6', name: 'Blue' },
  purple: { bg: '#a855f7', name: 'Purple' },
  pink: { bg: '#ec4899', name: 'Pink' },
};

interface NoteFormModalProps {
  visible: boolean;
  note?: Note | null;
  onClose: () => void;
  onSave: (data: CreateNoteRequest | UpdateNoteRequest) => void;
  isLoading?: boolean;
}

export function NoteFormModal({
  visible,
  note,
  onClose,
  onSave,
  isLoading = false,
}: NoteFormModalProps) {
  const { t } = useLanguage();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<NoteColor>('default');
  const [isPinned, setIsPinned] = useState(false);

  // Reset form when modal opens/closes or note changes
  useEffect(() => {
    if (visible) {
      if (note) {
        setTitle(note.title);
        setContent(note.content || '');
        setColor((note.color as NoteColor) || 'default');
        setIsPinned(note.is_pinned);
      } else {
        setTitle('');
        setContent('');
        setColor('default');
        setIsPinned(false);
      }
    }
  }, [visible, note]);

  const handleSave = () => {
    if (!title.trim()) return;

    const data: CreateNoteRequest | UpdateNoteRequest = {
      title: title.trim(),
      content: content.trim(),
      color,
      is_pinned: isPinned,
    };

    onSave(data);
  };

  const isEditing = !!note;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={onClose}
      >
        <Pressable
          className="bg-card rounded-t-3xl"
          style={{
            maxHeight: '90%',
            width: isDesktop ? 500 : '100%',
            alignSelf: 'center',
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20 }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">
                {isEditing ? (t('editNote') || 'Edit Note') : (t('newNote') || 'New Note')}
              </Text>
              <Pressable
                onPress={onClose}
                style={{ cursor: 'pointer' }}
                className="p-2"
              >
                <X size={24} color={colors.placeholder} />
              </Pressable>
            </View>

            {/* Title Input */}
            <View className="mb-4">
              <Text className="text-muted-foreground text-sm mb-2">
                {t('title') || 'Title'} *
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('enterTitle') || 'Enter title...'}
                placeholderTextColor={colors.mutedForeground}
                maxLength={200}
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                style={{
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  borderRadius: 8,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 16,
                  outlineStyle: 'none',
                } as any}
              />
            </View>

            {/* Content Input */}
            <View className="mb-4">
              <Text className="text-muted-foreground text-sm mb-2">
                {t('content') || 'Content'}
              </Text>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder={t('enterContent') || 'Write your note...'}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                style={{
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  borderRadius: 8,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 16,
                  minHeight: 120,
                  outlineStyle: 'none',
                } as any}
              />
            </View>

            {/* Color Picker */}
            <View className="mb-4">
              <Text className="text-muted-foreground text-sm mb-2">
                {t('color') || 'Color'}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {NOTE_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      cursor: 'pointer',
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: COLOR_DISPLAY[c].bg,
                      borderWidth: color === c ? 3 : 1,
                      borderColor: color === c ? colors.accent : colors.borderStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {color === c && (
                      <Check size={18} color={c === 'default' ? '#fff' : '#000'} />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Pin Toggle */}
            <View
              className={`flex-row items-center justify-between p-4 rounded-lg mb-6 ${
                isPinned ? 'bg-primary/20' : 'bg-muted'
              }`}
            >
              <View className="flex-row items-center">
                <Pin
                  size={20}
                  color={isPinned ? colors.accent : colors.placeholder}
                  fill={isPinned ? colors.accent : 'transparent'}
                />
                <Text className="text-foreground ml-3">
                  {t('pinNote') || 'Pin this note'}
                </Text>
              </View>
              <Toggle value={isPinned} onValueChange={setIsPinned} />
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={onClose}
                disabled={isLoading}
              >
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                onPress={handleSave}
                disabled={!title.trim()}
                isLoading={isLoading}
              >
                {isEditing ? (t('saveChanges') || 'Save') : (t('create') || 'Create')}
              </Button>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
