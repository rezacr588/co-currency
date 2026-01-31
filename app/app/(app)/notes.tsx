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
import { NoteCard, NoteFormModal } from '../../src/components/features/Notes';
import type { Note, CreateNoteRequest, UpdateNoteRequest } from '../../src/types/note';

export default function NotesScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="flex-row items-center flex-1">
          <Pressable
            onPress={() => router.back()}
            style={{ cursor: 'pointer' }}
            className="p-2 mr-2"
          >
            <ChevronLeft size={24} color="rgb(148, 163, 184)" />
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">
            {t('notes') || 'Notes'}
          </Text>
        </View>
        <Pressable
          onPress={handleAddNote}
          style={{ cursor: 'pointer' }}
          className="bg-accent p-2 rounded-lg"
        >
          <Plus size={24} color="#09090b" />
        </Pressable>
      </View>

      {/* Search Bar */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-muted rounded-lg px-3">
          <Search size={20} color="rgb(148, 163, 184)" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('searchNotes') || 'Search notes...'}
            placeholderTextColor="#71717a"
            selectionColor="rgb(212, 175, 55)"
            cursorColor="rgb(212, 175, 55)"
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 10,
              color: '#ffffff',
              fontSize: 16,
              outlineStyle: 'none',
            } as any}
          />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="rgb(212, 175, 55)"
          />
        }
      >
        {isPending ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
          </View>
        ) : error ? (
          <View className="bg-danger/10 p-4 rounded-xl">
            <Text className="text-danger text-center">
              {t('errorLoadingNotes') || 'Error loading notes'}
            </Text>
          </View>
        ) : sortedNotes.length === 0 ? (
          <View className="items-center justify-center py-16">
            <View className="bg-muted/50 p-6 rounded-full mb-4">
              <StickyNote size={48} color="rgb(148, 163, 184)" />
            </View>
            <Text className="text-lg font-medium text-foreground mb-2">
              {searchQuery
                ? (t('noNotesFound') || 'No notes found')
                : (t('noNotesYet') || 'No notes yet')}
            </Text>
            <Text className="text-muted-foreground text-center mb-4">
              {searchQuery
                ? (t('tryDifferentSearch') || 'Try a different search term')
                : (t('createFirstNote') || 'Create your first note to get started')}
            </Text>
            {!searchQuery && (
              <Pressable
                onPress={handleAddNote}
                style={{ cursor: 'pointer' }}
                className="bg-accent px-6 py-3 rounded-lg flex-row items-center"
              >
                <Plus size={20} color="#09090b" />
                <Text className="text-accent-foreground font-medium ml-2">
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
