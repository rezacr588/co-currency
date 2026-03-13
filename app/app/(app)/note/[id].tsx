import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, Pin, Edit3, Trash2 } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useAuth } from '../../../src/context/AuthContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { NoteFormModal } from '../../../src/components/features/Notes';
import {
  getBackupNote,
  removeNoteBackup,
  upsertNoteBackup,
} from '../../../src/offline/noteBackup';
import type { Note, UpdateNoteRequest } from '../../../src/types/note';

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

function asSingleParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function NoteDetailScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const colors = theme.colors;
  const userID = user?.id ?? '';
  const [showEditModal, setShowEditModal] = useState(false);
  const [localNote, setLocalNote] = useState<Note | null>(null);
  const [isUsingLocalBackup, setIsUsingLocalBackup] = useState(false);

  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const noteID = asSingleParam(params.id);

  useEffect(() => {
    if (!userID || !noteID) {
      setLocalNote(null);
      setIsUsingLocalBackup(false);
      return;
    }

    let active = true;
    void (async () => {
      const backupNote = await getBackupNote(userID, noteID);
      if (!active) return;
      setLocalNote(backupNote);
    })();

    return () => {
      active = false;
    };
  }, [noteID, userID]);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['note', noteID],
    enabled: !!noteID,
    queryFn: async () => {
      try {
        const response = await api.notes.get(noteID as string);
        if (userID) {
          await upsertNoteBackup(userID, response.note);
        }
        return { note: response.note, fromLocalBackup: false };
      } catch (remoteError) {
        if (userID) {
          const backupNote = await getBackupNote(userID, noteID as string);
          if (backupNote) {
            return { note: backupNote, fromLocalBackup: true };
          }
        }

        throw remoteError;
      }
    },
  });

  useEffect(() => {
    if (!data?.note) return;
    setLocalNote(data.note);
    setIsUsingLocalBackup(data.fromLocalBackup);
  }, [data]);

  const note = useMemo(() => data?.note ?? localNote, [data, localNote]);
  const colorStyle = note ? (COLOR_STYLES[note.color] || COLOR_STYLES.default) : COLOR_STYLES.default;

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateNoteRequest) => api.notes.update(noteID as string, payload),
    onSuccess: async ({ note: updatedNote }) => {
      setLocalNote(updatedNote);
      if (userID) {
        await upsertNoteBackup(userID, updatedNote);
      }
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note', noteID] });
      setIsUsingLocalBackup(false);
      setShowEditModal(false);
    },
    onError: (err) => {
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : 'Failed to update note'
      );
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: () => api.notes.togglePin(noteID as string),
    onSuccess: async ({ note: updatedNote }) => {
      setLocalNote(updatedNote);
      if (userID) {
        await upsertNoteBackup(userID, updatedNote);
      }
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note', noteID] });
      setIsUsingLocalBackup(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.notes.delete(noteID as string),
    onSuccess: async () => {
      if (userID && noteID) {
        await removeNoteBackup(userID, noteID);
      }
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      router.back();
    },
    onError: (err) => {
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : 'Failed to delete note'
      );
    },
  });

  const handleDelete = () => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const handleSave = (payload: UpdateNoteRequest) => {
    updateMutation.mutate(payload);
  };

  const isBusy =
    togglePinMutation.isPending || deleteMutation.isPending || updateMutation.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ cursor: 'pointer', padding: 8, marginEnd: 8 }}
          >
            <ChevronLeft size={24} color={colors.placeholder} />
          </Pressable>
          <Text
            style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}
            numberOfLines={1}
          >
            Note
          </Text>
        </View>

        {note && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => togglePinMutation.mutate()}
              disabled={isBusy}
              style={{ cursor: 'pointer', padding: 8 }}
            >
              <Pin
                size={20}
                color={note.is_pinned ? colors.accent : colors.mutedForeground}
                fill={note.is_pinned ? colors.accent : 'transparent'}
              />
            </Pressable>
            <Pressable
              onPress={() => setShowEditModal(true)}
              disabled={isBusy}
              style={{ cursor: 'pointer', padding: 8 }}
            >
              <Edit3 size={20} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              disabled={isBusy}
              style={{ cursor: 'pointer', padding: 8 }}
            >
              <Trash2 size={20} color={colors.danger} />
            </Pressable>
          </View>
        )}
      </View>

      {note && isUsingLocalBackup ? (
        <View style={{ marginHorizontal: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.warning + '55', backgroundColor: colors.warning + '14', paddingHorizontal: 12, paddingVertical: 10 }}>
          <AlertTriangle size={16} color={colors.warning} />
          <Text style={{ color: colors.warning, flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            {t('notesLocalBackup') || 'Showing your saved local notes while the remote list is unavailable.'}
          </Text>
        </View>
      ) : null}

      {isPending && !note ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error && !note ? (
        <View
          style={{
            flex: 1,
            padding: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.danger, marginBottom: 16, textAlign: 'center' }}>
            Failed to load note.
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={{
              cursor: 'pointer',
              backgroundColor: colors.accent,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold' }}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : note ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              padding: 16,
              backgroundColor:
                colorStyle.bg === 'transparent' ? colors.card : colorStyle.bg,
              borderColor:
                colorStyle.border === 'transparent' ? colors.border : colorStyle.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.foreground }}
                >
                  {note.title}
                </Text>
                <Text
                  style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 6 }}
                >
                  Updated {new Date(note.updated_at).toLocaleString()}
                </Text>
              </View>
              {note.is_pinned ? (
                <View style={{ borderRadius: 999, backgroundColor: colors.accent + '18', paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: colors.accent, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                    {t('pin') || 'Pin'}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={{
                marginTop: 18,
                color: note.content ? colors.foreground : colors.mutedForeground,
                fontSize: 16,
                lineHeight: 24,
              }}
            >
              {note.content || 'No content'}
            </Text>
          </View>
        </ScrollView>
      ) : null}

      {note ? (
        <NoteFormModal
          visible={showEditModal}
          note={note}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
          isLoading={updateMutation.isPending}
        />
      ) : null}
    </SafeAreaView>
  );
}
