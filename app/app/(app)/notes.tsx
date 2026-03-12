import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRefreshableQuery } from '../../src/hooks/useRefreshableQuery';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ChevronLeft,
  Plus,
  Search,
  StickyNote,
} from 'lucide-react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { NoteCard, NoteFormModal } from '../../src/components/features/Notes';
import {
  filterNotesByQuery,
  getNotesBackup,
  setNotesBackup,
  sortNotesByPinnedUpdated,
  upsertNoteInCollection,
  removeNoteFromCollection,
} from '../../src/offline/noteBackup';
import type { Note, CreateNoteRequest, UpdateNoteRequest } from '../../src/types/note';

export default function NotesScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const colors = theme.colors;
  const userID = user?.id ?? '';

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const numColumns = isDesktop ? 4 : isTablet ? 3 : 2;

  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [localNotes, setLocalNotes] = useState<Note[]>([]);
  const [isUsingLocalBackup, setIsUsingLocalBackup] = useState(false);
  const localNotesCountRef = useRef(0);

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
      setIsUsingLocalBackup(false);
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

  const { data, isPending, error, refreshing, onRefresh } = useRefreshableQuery({
    queryKey: ['notes', userID, 'remote'],
    queryFn: () => api.notes.list(),
    enabled: !!userID,
  });

  useEffect(() => {
    if (!userID || !data) return;

    const remoteNotes = data.notes ?? [];
    const shouldPreserveLocal = remoteNotes.length === 0 && localNotesCountRef.current > 0;
    setIsUsingLocalBackup(shouldPreserveLocal);

    if (shouldPreserveLocal) {
      return;
    }

    setLocalNotes(remoteNotes);
    void setNotesBackup(userID, remoteNotes);
  }, [data, userID]);

  const visibleNotes = useMemo(() => {
    return sortNotesByPinnedUpdated(filterNotesByQuery(localNotes, searchQuery));
  }, [localNotes, searchQuery]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateNoteRequest) => api.notes.create(payload),
    onSuccess: ({ note }) => {
      updateLocalNotes((previous) => upsertNoteInCollection(previous, note));
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setIsUsingLocalBackup(false);
      setShowFormModal(false);
      setSelectedNote(null);
    },
    onError: (err) => {
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : t('createNoteFailed') || 'Failed to create note'
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateNoteRequest }) =>
      api.notes.update(id, payload),
    onSuccess: ({ note }) => {
      updateLocalNotes((previous) => upsertNoteInCollection(previous, note));
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setIsUsingLocalBackup(false);
      setShowFormModal(false);
      setSelectedNote(null);
    },
    onError: (err) => {
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : t('updateNoteFailed') || 'Failed to update note'
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.notes.delete(id),
    onSuccess: (_result, noteID) => {
      updateLocalNotes((previous) => removeNoteFromCollection(previous, noteID));
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (err) => {
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : t('deleteNoteFailed') || 'Failed to delete note'
      );
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: (id: string) => api.notes.togglePin(id),
    onSuccess: ({ note }) => {
      updateLocalNotes((previous) => upsertNoteInCollection(previous, note));
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const handleNotePress = (note: Note) => {
    router.push({
      pathname: '/(app)/note/[id]' as any,
      params: { id: note.id },
    });
  };

  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setShowFormModal(true);
  };

  const handleNoteLongPress = (note: Note) => {
    Alert.alert(note.title, t('noteActions') || 'Choose an action', [
      {
        text: t('edit') || 'Edit',
        onPress: () => handleEditNote(note),
      },
      {
        text: note.is_pinned ? (t('unpin') || 'Unpin') : (t('pin') || 'Pin'),
        onPress: () => togglePinMutation.mutate(note.id),
      },
      {
        text: t('delete') || 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            t('deleteNote') || 'Delete Note',
            t('deleteNoteConfirm') || 'Are you sure you want to delete this note?',
            [
              { text: t('cancel') || 'Cancel', style: 'cancel' },
              {
                text: t('delete') || 'Delete',
                style: 'destructive',
                onPress: () => deleteMutation.mutate(note.id),
              },
            ]
          );
        },
      },
      { text: t('cancel') || 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = (payload: CreateNoteRequest | UpdateNoteRequest) => {
    if (selectedNote) {
      updateMutation.mutate({ id: selectedNote.id, payload });
      return;
    }

    createMutation.mutate(payload as CreateNoteRequest);
  };

  const handleAddNote = () => {
    setSelectedNote(null);
    setShowFormModal(true);
  };

  const showLoadingState = isPending && localNotes.length === 0;
  const showRemoteFallbackNotice = isUsingLocalBackup || (!!error && localNotes.length > 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ cursor: 'pointer', padding: 8, marginRight: 8 }}
          >
            <ChevronLeft size={24} color={colors.placeholder} />
          </Pressable>
          <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {t('notes') || 'Notes'}
          </Text>
        </View>
        <Pressable
          onPress={handleAddNote}
          style={{ cursor: 'pointer', backgroundColor: colors.accent, padding: 8, borderRadius: 8 }}
        >
          <Plus size={24} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: 8, paddingHorizontal: 12 }}>
          <Search size={20} color={colors.placeholder} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('searchNotes') || 'Search notes...'}
            placeholderTextColor={colors.mutedForeground}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 10,
              color: colors.foreground,
              fontSize: 16,
              outlineStyle: 'none',
            } as any}
          />
        </View>

        {showRemoteFallbackNotice ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.warning + '55', backgroundColor: colors.warning + '14', paddingHorizontal: 12, paddingVertical: 10 }}>
            <AlertTriangle size={16} color={colors.warning} />
            <Text style={{ color: colors.warning, flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
              {t('notesLocalBackup') || 'Showing your saved local notes while the remote list is unavailable.'}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {showLoadingState ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : error && localNotes.length === 0 ? (
          <View style={{ backgroundColor: colors.danger + '1a', padding: 16, borderRadius: 12 }}>
            <Text style={{ color: colors.danger, textAlign: 'center' }}>
              {t('errorLoadingNotes') || 'Error loading notes'}
            </Text>
          </View>
        ) : visibleNotes.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <View style={{ backgroundColor: colors.muted + '80', padding: 24, borderRadius: 9999, marginBottom: 16 }}>
              <StickyNote size={48} color={colors.placeholder} />
            </View>
            <Text style={{ fontSize: 18, fontFamily: 'Inter_500Medium', color: colors.foreground, marginBottom: 8 }}>
              {searchQuery
                ? (t('noNotesFound') || 'No notes found')
                : (t('noNotesYet') || 'No notes yet')}
            </Text>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 16 }}>
              {searchQuery
                ? (t('tryDifferentSearch') || 'Try a different search term')
                : (t('createFirstNote') || 'Create your first note to get started')}
            </Text>
            {!searchQuery && (
              <Pressable
                onPress={handleAddNote}
                style={{ cursor: 'pointer', backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
              >
                <Plus size={20} color={colors.primaryForeground} />
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium', marginLeft: 8 }}>
                  {t('addNote') || 'Add Note'}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {visibleNotes.map((note) => (
              <View
                key={note.id}
                style={{
                  width: `${100 / numColumns - (numColumns - 1) * 1.5}%`,
                  minWidth: 150,
                }}
              >
                <NoteCard
                  note={note}
                  onPress={handleNotePress}
                  onLongPress={handleNoteLongPress}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <NoteFormModal
        visible={showFormModal}
        note={selectedNote}
        onClose={() => {
          setShowFormModal(false);
          setSelectedNote(null);
        }}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </SafeAreaView>
  );
}
