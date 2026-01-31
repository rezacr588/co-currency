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
                <X size={24} color="rgb(148, 163, 184)" />
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
                placeholderTextColor="#71717a"
                maxLength={200}
                selectionColor="rgb(212, 175, 55)"
                cursorColor="rgb(212, 175, 55)"
                style={{
                  backgroundColor: '#27272a',
                  borderWidth: 1,
                  borderColor: '#3f3f46',
                  borderRadius: 8,
                  padding: 14,
                  color: '#ffffff',
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
                placeholderTextColor="#71717a"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                selectionColor="rgb(212, 175, 55)"
                cursorColor="rgb(212, 175, 55)"
                style={{
                  backgroundColor: '#27272a',
                  borderWidth: 1,
                  borderColor: '#3f3f46',
                  borderRadius: 8,
                  padding: 14,
                  color: '#ffffff',
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
                      borderColor: color === c ? 'rgb(212, 175, 55)' : '#3f3f46',
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
            <Pressable
              onPress={() => setIsPinned(!isPinned)}
              style={{ cursor: 'pointer' }}
              className={`flex-row items-center justify-between p-4 rounded-lg mb-6 ${
                isPinned ? 'bg-primary/20' : 'bg-muted'
              }`}
            >
              <View className="flex-row items-center">
                <Pin
                  size={20}
                  color={isPinned ? 'rgb(212, 175, 55)' : 'rgb(148, 163, 184)'}
                  fill={isPinned ? 'rgb(212, 175, 55)' : 'transparent'}
                />
                <Text className="text-foreground ml-3">
                  {t('pinNote') || 'Pin this note'}
                </Text>
              </View>
              <View
                className={`w-12 h-7 rounded-full ${
                  isPinned ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <View
                  className={`w-5 h-5 bg-white rounded-full mt-1 ${
                    isPinned ? 'ml-6' : 'ml-1'
                  }`}
                />
              </View>
            </Pressable>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={onClose}
                disabled={isLoading}
                style={{ cursor: 'pointer' }}
                className={`flex-1 p-4 rounded-lg border border-border items-center ${
                  isLoading ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-foreground font-medium">
                  {t('cancel') || 'Cancel'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={isLoading || !title.trim()}
                style={{ cursor: 'pointer' }}
                className={`flex-1 bg-accent p-4 rounded-lg flex-row items-center justify-center ${
                  isLoading || !title.trim() ? 'opacity-50' : ''
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#09090b" size="small" />
                ) : (
                  <Text className="text-accent-foreground font-medium">
                    {isEditing ? (t('saveChanges') || 'Save') : (t('create') || 'Create')}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
