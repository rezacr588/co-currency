import { useEffect, useMemo, useState } from 'react';
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
import { spacing, radii } from '../../../src/theme';
import { HIT_SLOP_SM } from '../../../src/constants/hitSlop';
import { NoteFormModal } from '../../../src/components/features/Notes';
import {
  getBackupNote,
  removeNoteBackup,
  upsertNoteBackup,
} from '../../../src/offline/noteBackup';
import type { Note, UpdateNoteRequest } from '../../../src/types/note';

type NoteColorStyle = { bg: string; border: string };

function useNoteDetailColorStyles(): Record<string, NoteColorStyle> {
  const theme = useTheme();
  const { colors, alpha } = theme;
  return {
    default: { bg: colors.card, border: colors.border },
    red: { bg: alpha(colors.palette.red, 0.1), border: alpha(colors.palette.red, 0.3) },
    orange: { bg: alpha(colors.palette.orange, 0.1), border: alpha(colors.palette.orange, 0.3) },
    yellow: { bg: alpha(colors.palette.yellow, 0.1), border: alpha(colors.palette.yellow, 0.3) },
    green: { bg: alpha(colors.palette.green, 0.1), border: alpha(colors.palette.green, 0.3) },
    blue: { bg: alpha(colors.palette.blue, 0.1), border: alpha(colors.palette.blue, 0.3) },
    purple: { bg: alpha(colors.palette.purple, 0.1), border: alpha(colors.palette.purple, 0.3) },
    pink: { bg: alpha(colors.palette.pink, 0.1), border: alpha(colors.palette.pink, 0.3) },
  };
}

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
  const colorStyles = useNoteDetailColorStyles();

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
  const colorStyle = note ? (colorStyles[note.color] ?? colorStyles.default) : colorStyles.default;

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
      t('deleteNote') || 'Delete Note',
      t('confirmDeleteNote') || 'Are you sure you want to delete this note?',
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
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={HIT_SLOP_SM}
            accessibilityRole="button"
            accessibilityLabel={t('a11yBack') || 'Back'}
            style={{ cursor: 'pointer', padding: spacing.sm, marginEnd: spacing.sm }}
          >
            <ChevronLeft size={24} color={colors.placeholder} />
          </Pressable>
          <Text
            style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}
            numberOfLines={1}
          >
            {t('note') || 'Note'}
          </Text>
        </View>

        {note && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              onPress={() => togglePinMutation.mutate()}
              disabled={isBusy}
              hitSlop={HIT_SLOP_SM}
              accessibilityRole="button"
              accessibilityLabel={t('pin') || 'Pin'}
              accessibilityState={{ selected: note.is_pinned, disabled: isBusy }}
              style={{ cursor: 'pointer', padding: spacing.sm }}
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
              hitSlop={HIT_SLOP_SM}
              accessibilityRole="button"
              accessibilityLabel={t('a11yEdit') || 'Edit'}
              accessibilityState={{ disabled: isBusy }}
              style={{ cursor: 'pointer', padding: spacing.sm }}
            >
              <Edit3 size={20} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              disabled={isBusy}
              hitSlop={HIT_SLOP_SM}
              accessibilityRole="button"
              accessibilityLabel={t('a11yDelete') || 'Delete'}
              accessibilityState={{ disabled: isBusy }}
              style={{ cursor: 'pointer', padding: spacing.sm }}
            >
              <Trash2 size={20} color={colors.danger} />
            </Pressable>
          </View>
        )}
      </View>

      {note && isUsingLocalBackup ? (
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: theme.alpha(colors.warning, 0.33), backgroundColor: theme.alpha(colors.warning, 0.08), paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 }}>
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
            padding: spacing.xxl,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.danger, marginBottom: spacing.lg, textAlign: 'center' }}>
            {t('failedToLoadNote') || 'Failed to load note.'}
          </Text>
          <Pressable
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel={t('a11yRetry') || 'Retry'}
            style={{
              cursor: 'pointer',
              backgroundColor: colors.accent,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.sm + 2,
              borderRadius: radii.sm,
            }}
          >
            <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold' }}>
              {t('retry') || 'Retry'}
            </Text>
          </Pressable>
        </View>
      ) : note ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        >
          <View
            style={{
              borderRadius: radii.md,
              borderWidth: 1,
              padding: spacing.lg,
              backgroundColor: colorStyle.bg,
              borderColor: colorStyle.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.foreground }}
                >
                  {note.title}
                </Text>
                <Text
                  style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 6 }}
                >
                  {t('updated') || 'Updated'} {new Date(note.updated_at).toLocaleString()}
                </Text>
              </View>
              {note.is_pinned ? (
                <View style={{ borderRadius: radii.full, backgroundColor: theme.alpha(colors.accent, 0.1), paddingHorizontal: spacing.sm + 2, paddingVertical: 6 }}>
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
              {note.content || (t('noContent') || 'No content')}
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
