import { memo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Send, RotateCcw } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../../context/LanguageContext';
import { AttachmentButton, AttachmentPreview } from './AttachmentPicker';
import { VoiceRecorder } from './VoiceRecorder';

export interface ChatInputComposerProps {
  message: string;
  setMessage: (text: string) => void;
  onSend: () => void;
  thinkingMode: 'auto' | 'fast' | 'thinking';
  setThinkingMode: (mode: 'auto' | 'fast' | 'thinking') => void;
  attachment: any;
  onAttach: () => void;
  onClearAttachment: () => void;
  isRecording: boolean;
  onCancelVoice: () => void;
  onVoiceComplete: (uri: string, mimeType: string, name: string) => void;
  onVoiceError: (msg: string) => void;
  isSending: boolean;
  canSend: boolean;
  maxLength: number;
  charCountThreshold: number;
  inputPlaceholder: string;
  aiRateLimitPerMinute: number;
  aiRateLimitBurst: number;
  sendError: string | null;
  lastFailedMessage: string | null;
  onRetry: () => void;
}

export const ChatInputComposer = memo(function ChatInputComposer({
  message,
  setMessage,
  onSend,
  thinkingMode,
  setThinkingMode,
  attachment,
  onAttach,
  onClearAttachment,
  isRecording,
  onCancelVoice,
  onVoiceComplete,
  onVoiceError,
  isSending,
  canSend,
  maxLength,
  charCountThreshold,
  inputPlaceholder,
  aiRateLimitPerMinute,
  aiRateLimitBurst,
  sendError,
  lastFailedMessage,
  onRetry,
}: ChatInputComposerProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingHorizontal: theme.spacing.lg, paddingTop: 10, paddingBottom: Math.max(insets.bottom, theme.spacing.md), backgroundColor: colors.background }}
    >
      {sendError && (
        <View style={{ backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger + '33', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.danger, fontSize: 12, flex: 1 }}>{sendError}</Text>
            {lastFailedMessage && (
              <Pressable
                onPress={onRetry}
                disabled={isSending}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.danger + '20',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  marginStart: 8,
                }}
              >
                <RotateCcw size={12} color={colors.danger} />
                <Text style={{ color: colors.danger, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginStart: 4 }}>
                  {t('retry') || 'Retry'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 20,
          padding: 10,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        {/* Voice Recording UI */}
        {isRecording && (
          <VoiceRecorder
            onRecordingComplete={onVoiceComplete}
            onCancel={onCancelVoice}
            onError={onVoiceError}
          />
        )}

        {/* Attachment Preview */}
        {attachment && !isRecording && (
          <AttachmentPreview attachment={attachment} onRemove={onClearAttachment} />
        )}

        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          {(['auto', 'fast', 'thinking'] as const).map((mode) => {
            const selected = thinkingMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setThinkingMode(mode)}
                style={({ pressed }) => [{
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: selected ? colors.accent + '22' : colors.card,
                }, pressed && { opacity: 0.75 }]}
              >
                <Text style={{ fontSize: 11, color: selected ? colors.accent : colors.mutedForeground, fontFamily: selected ? 'Inter_600SemiBold' : undefined }}>
                  {mode}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          {!isRecording && (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AttachmentButton onPress={onAttach} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minHeight: 46,
                maxHeight: 130,
              }}
            >
              <TextInput
                value={message}
                onChangeText={(text) => setMessage(text.slice(0, maxLength))}
                placeholder={inputPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                multiline
                editable={!isSending}
                maxLength={maxLength}
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                style={{
                  color: colors.foreground,
                  fontSize: 16,
                  lineHeight: 21,
                  textAlignVertical: 'top',
                  paddingVertical: Platform.OS === 'ios' ? 6 : 2,
                  minHeight: 30,
                  maxHeight: 108,
                }}
              />
            </View>
            {message.length > charCountThreshold && (
              <Text style={{
                textAlign: 'right',
                marginTop: 4,
                marginEnd: 4,
                fontSize: 10,
                color: message.length >= maxLength ? colors.danger : colors.mutedForeground,
              }}>
                {message.length}/{maxLength}
              </Text>
            )}
          </View>

          <Pressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={({ pressed }) => [{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary,
              opacity: !canSend ? 0.45 : pressed ? 0.72 : 1,
            }]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Send size={18} color={colors.primaryForeground} />
            )}
          </Pressable>
        </View>

        <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 8, marginHorizontal: 4 }}>
          {t('rateLimit') || 'Rate limit'}: {aiRateLimitPerMinute}/min ({t('burst') || 'burst'} {aiRateLimitBurst})
        </Text>
      </View>
    </View>
  );
});
