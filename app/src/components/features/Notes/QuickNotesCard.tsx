import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StickyNote, Plus, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';
import { NoteFormModal } from './NoteFormModal';
import type { Note, CreateNoteRequest } from '../../../types/note';

const NOTE_COLORS: Record<string, string> = {
  yellow: '#fbbf24',
  blue: '#3b82f6',
  green: '#22c55e',
  pink: '#ec4899',
  purple: '#8b5cf6',
  orange: '#f97316',
  red: '#ef4444',
  teal: '#14b8a6',
};

export function QuickNotesCard() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: CreateNoteRequest) => api.notes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setShowForm(false);
    },
  });

  const { data: notesData, isPending } = useQuery({
    queryKey: ['notes'],
    queryFn: () => api.notes.list(),
    staleTime: 2 * 60 * 1000,
  });

  const notes: Note[] = notesData?.notes || [];

  // Sort: pinned first, then by updated_at desc
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  }).slice(0, 3);

  const handleAdd = () => {
    haptics.light();
    setShowForm(true);
  };

  const handleViewAll = () => {
    haptics.light();
    router.push('/(app)/notes');
  };

  if (isPending) {
    return (
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 60 }}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <StickyNote size={18} color={colors.mutedForeground} />
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginLeft: 8 }}>{t('quickNotes') || 'Quick Notes'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={handleAdd} hitSlop={8} style={{ cursor: 'pointer', padding: 4, marginRight: 4 }}>
            <Plus size={18} color={colors.accent} />
          </Pressable>
          {notes.length > 0 && (
            <Pressable onPress={handleViewAll} hitSlop={8} style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', padding: 4 }}>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginRight: 4 }}>{t('viewAllNotes') || 'View all'}</Text>
              <ArrowRight size={12} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Notes List */}
      {sortedNotes.length === 0 ? (
        <Pressable
          onPress={handleAdd}
          style={({ pressed }) => [{ cursor: 'pointer', alignItems: 'center', paddingVertical: 16 }, pressed && { opacity: 0.7 }]}
        >
          <StickyNote size={24} color={colors.subtleForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>{t('noNotesYet') || 'No notes yet'}</Text>
          <Text style={{ color: colors.accent, fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 4 }}>
            + {t('addNote') || 'Add a note'}
          </Text>
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          {sortedNotes.map((note) => (
            <Pressable
              key={note.id}
              onPress={() =>
                router.push({
                  pathname: '/(app)/note/[id]' as any,
                  params: { id: note.id },
                })
              }
              style={({ pressed }) => [{ cursor: 'pointer', backgroundColor: colors.muted + '80', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'flex-start' }, pressed && { opacity: 0.7 }]}
            >
              <View
                style={{ width: 12, height: 12, borderRadius: 9999, marginTop: 4, marginRight: 12, backgroundColor: NOTE_COLORS[note.color] || NOTE_COLORS.yellow }}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground, flex: 1 }} numberOfLines={1}>
                    {note.title}
                  </Text>
                  {note.is_pinned && (
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: 8 }}>📌</Text>
                  )}
                </View>
                {note.content ? (
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                    {note.content}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Note Form Modal */}
      <NoteFormModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSave={(data) => createMutation.mutate(data as CreateNoteRequest)}
        isLoading={createMutation.isPending}
      />
    </View>
  );
}
