import { useState, useCallback } from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Plus,
  Search,
  StickyNote,
  Trash2,
  Pin,
} from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { NoteCard, NoteFormModal } from '../../src/components/features/Notes';
import type { Note, CreateNoteRequest, UpdateNoteRequest } from '../../src/types/note';

export default function NotesScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const colors = theme.colors;

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const numColumns = isDesktop ? 4 : isTablet ? 3 : 2;

  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch notes with search
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['notes', searchQuery],
    queryFn: () => api.notes.list(searchQuery || undefined),
  });

  const notes = data?.notes || [];

  // Sort notes: pinned first, then by updated date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateNoteRequest) => api.notes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
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

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNoteRequest }) =>
      api.notes.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.notes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (err) => {
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : t('deleteNoteFailed') || 'Failed to delete note'
      );
    },
  });

  // Toggle pin mutation
  const togglePinMutation = useMutation({
    mutationFn: (id: string) => api.notes.togglePin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleNotePress = (note: Note) => {
    setSelectedNote(note);
    setShowFormModal(true);
  };

  const handleNoteLongPress = (note: Note) => {
    Alert.alert(note.title, t('noteActions') || 'Choose an action', [
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

  const handleSave = (data: CreateNoteRequest | UpdateNoteRequest) => {
    if (selectedNote) {
      updateMutation.mutate({ id: selectedNote.id, data });
    } else {
      createMutation.mutate(data as CreateNoteRequest);
    }
  };

  const handleAddNote = () => {
    setSelectedNote(null);
    setShowFormModal(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
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

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
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
      </View>

      {/* Content */}
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
        {isPending ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : error ? (
          <View style={{ backgroundColor: colors.danger + '1a', padding: 16, borderRadius: 12 }}>
            <Text style={{ color: colors.danger, textAlign: 'center' }}>
              {t('errorLoadingNotes') || 'Error loading notes'}
            </Text>
          </View>
        ) : sortedNotes.length === 0 ? (
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
            {sortedNotes.map((note) => (
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

      {/* Note Form Modal */}
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
