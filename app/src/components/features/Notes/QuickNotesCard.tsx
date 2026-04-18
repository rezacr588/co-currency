import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StickyNote, Plus, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { spacing, radii } from '../../../theme';
import {
  getNotesBackup,
  setNotesBackup,
  sortNotesByPinnedUpdated,
  upsertNoteInCollection,
} from '../../../offline/noteBackup';
import { haptics } from '../../../utils/haptics';
import { HIT_SLOP_SM } from '../../../constants/hitSlop';
import { NoteFormModal } from './NoteFormModal';
import type { Note, CreateNoteRequest } from '../../../types/note';

function useNoteDotColors(): Record<string, string> {
  const theme = useTheme();
  const { colors } = theme;
  return {
    yellow: colors.palette.yellow,
    blue: colors.palette.blue,
    green: colors.palette.green,
    pink: colors.palette.pink,
    purple: colors.palette.purple,
    orange: colors.palette.orange,
    red: colors.palette.red,
    teal: colors.palette.teal,
  };
}

export function QuickNotesCard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const queryClient = useQueryClient();
  const userID = user?.id ?? '';
  const [showForm, setShowForm] = useState(false);
  const [localNotes, setLocalNotes] = useState<Note[]>([]);
  const localNotesCountRef = useRef(0);
  const dotColors = useNoteDotColors();

  localNotesCountRef.current = localNotes.length;

  const updateLocalNotes = useCallback((updater: (previous: Note[]) => Note[]) => {
    setLocalNotes((previous) => {
      const next = updater(previous);
      if (userID) {
        void setNotesBackup(userID, next);
      }
      return next;
    });
  }, [userID]);

  useEffect(() => {
    if (!userID) {
      setLocalNotes([]);
      return;
    }

    let active = true;
    void (async () => {
      const backup = await getNotesBackup(userID);
      if (!active) return;
      setLocalNotes(backup?.notes ?? []);
    })();

    return () => {
      active = false;
    };
  }, [userID]);

  const createMutation = useMutation({
    mutationFn: (data: CreateNoteRequest) => api.notes.create(data),
    onSuccess: ({ note }) => {
      updateLocalNotes((previous) => upsertNoteInCollection(previous, note));
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setShowForm(false);
    },
  });

  const { data: notesData, isPending } = useQuery({
    queryKey: ['notes', userID, 'quick'],
    queryFn: () => api.notes.list(),
    enabled: !!userID,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (!userID || !notesData) return;

    const remoteNotes = notesData.notes ?? [];
    if (remoteNotes.length === 0 && localNotesCountRef.current > 0) {
      return;
    }

    setLocalNotes(remoteNotes);
    void setNotesBackup(userID, remoteNotes);
  }, [notesData, userID]);

  const sortedNotes = useMemo(() => sortNotesByPinnedUpdated(localNotes).slice(0, 3), [localNotes]);

  const handleAdd = () => {
    haptics.light();
    setShowForm(true);
  };

  const handleViewAll = () => {
    haptics.light();
    router.push('/(app)/notes');
  };

  if (isPending && localNotes.length === 0) {
    return (
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', minHeight: 60 }}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, borderRadius: radii.md }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <StickyNote size={18} color={colors.mutedForeground} />
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginStart: spacing.sm }}>{t('quickNotes') || 'Quick Notes'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={handleAdd}
            hitSlop={HIT_SLOP_SM}
            accessibilityRole="button"
            accessibilityLabel={t('a11yAdd') || 'Add'}
            style={{ cursor: 'pointer', padding: spacing.xs, marginEnd: spacing.xs }}
          >
            <Plus size={18} color={colors.accent} />
          </Pressable>
          {localNotes.length > 0 && (
            <Pressable
              onPress={handleViewAll}
              hitSlop={HIT_SLOP_SM}
              accessibilityRole="button"
              accessibilityLabel={t('a11yViewAll') || 'View all'}
              style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', padding: spacing.xs }}
            >
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginEnd: spacing.xs }}>{t('viewAllNotes') || 'View all'}</Text>
              <ArrowRight size={12} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Notes List */}
      {sortedNotes.length === 0 ? (
        <Pressable
          onPress={handleAdd}
          style={({ pressed }) => [{ cursor: 'pointer', alignItems: 'center', paddingVertical: spacing.lg }, pressed && { opacity: 0.7 }]}
        >
          <StickyNote size={24} color={colors.subtleForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: spacing.sm }}>{t('noNotesYet') || 'No notes yet'}</Text>
          <Text style={{ color: colors.accent, fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: spacing.xs }}>
            + {t('addNote') || 'Add a note'}
          </Text>
        </Pressable>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {sortedNotes.map((note) => (
            <Pressable
              key={note.id}
              onPress={() =>
                router.push({
                  pathname: '/(app)/note/[id]' as any,
                  params: { id: note.id },
                })
              }
              style={({ pressed }) => [{ cursor: 'pointer', backgroundColor: theme.alpha(colors.muted, 0.5), padding: spacing.md, borderRadius: radii.sm, flexDirection: 'row', alignItems: 'flex-start' }, pressed && { opacity: 0.7 }]}
            >
              <View
                style={{ width: 12, height: 12, borderRadius: radii.full, marginTop: spacing.xs, marginEnd: spacing.md, backgroundColor: dotColors[note.color] || dotColors.yellow }}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground, flex: 1 }} numberOfLines={1}>
                    {note.title}
                  </Text>
                  {note.is_pinned && (
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginStart: spacing.sm }}>📌</Text>
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
