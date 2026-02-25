import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Markdown from 'react-native-markdown-display';
import {
  Send,
  Plus,
  Trash2,
  Sparkles,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { AttachmentButton, AttachmentPreview, useAttachmentPicker } from '../../../../src/components/features/Chat';
import { VoiceRecorder } from '../../../../src/components/features/Chat';
import type { ChatMessage, Conversation, ConversationWithMessages } from '../../../../src/api/chat';
import type { SmartParseResponse } from '../../../../src/types/wallet';
import type { ConversionResult } from '../../../../src/types/currency';
import type { Goal, RecurringTransaction } from '../../../../src/types/goal';
import { formatNumber } from '../../../../src/utils/format';

const MAX_MESSAGE_LENGTH = 5000;
const CHAR_COUNT_THRESHOLD = 4000;

function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Connection lost. Please check your internet and try again.';
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('503') || msg.toLowerCase().includes('unavailable')) {
    return 'AI assistant is temporarily unavailable. Please try again in a moment.';
  }
  if (msg.includes('429') || msg.toLowerCase().includes('too many')) {
    return 'Too many requests. Please wait a moment before sending another message.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch')) {
    return 'Connection lost. Please check your internet and try again.';
  }
  return 'Something went wrong. Please try again.';
}


type PendingAction =
  | {
      kind: 'transaction';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      parsed?: SmartParseResponse;
      error?: string;
    }
  | {
      kind: 'recurring';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      parsed?: SmartParseResponse;
      selectedFrequency?: string;
      result?: RecurringTransaction;
      error?: string;
    }
  | {
      kind: 'goal_contribution';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      parsed?: SmartParseResponse;
      selectedGoalId?: string;
      goals?: Goal[];
      result?: { goal: Goal; transaction: unknown };
      error?: string;
    }
  | {
      kind: 'convert';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      from: string;
      to: string;
      amount: number;
      result?: ConversionResult;
      error?: string;
    }
  | {
      kind: 'rate';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      from: string;
      to: string;
      result?: ConversionResult;
      error?: string;
    };

export default function AIChatScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const showSidebar = isDesktop || isTablet;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;
  const messageMaxWidth = isDesktop ? 560 : Math.min(width * 0.85, 560);
  const contentWidthStyle = {
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    width: '100%',
  } as const;

  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingDraft, setStreamingDraft] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId || null
  );
  // Editable transaction state for validation workflow
  const [editMode, setEditMode] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'credit' | 'debit'>('debit');
  const [editCurrency, setEditCurrency] = useState('USD');
  const [editDescription, setEditDescription] = useState('');

  const { attachment, isRecordingVoice, showPicker: showAttachmentPicker, clearAttachment, handleVoiceComplete, cancelVoice } = useAttachmentPicker();

  const scrollViewRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottomRef = useRef(true);
  const pendingMutationRef = useRef(false);
  const lastSentMessageRef = useRef<string>('');
  const clearStreamingState = useCallback(() => {
    setIsTyping(false);
    setStreamingDraft('');
  }, []);
  const clearConversationTransientState = useCallback(() => {
    setPendingAction(null);
    setSendError(null);
    setStreamingDraft('');
  }, []);
  const toMutationErrorMessage = useCallback(
    (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback),
    []
  );
  const updatePendingAction = useCallback(
    (kind: PendingAction['kind'], patch: Partial<PendingAction>) => {
      setPendingAction((current) =>
        current && current.kind === kind ? ({ ...current, ...patch } as PendingAction) : current
      );
    },
    []
  );

  // Markdown styles for AI responses
  const markdownStyles = useMemo(() => StyleSheet.create({
    body: {
      color: colors.foreground,
      fontSize: 15,
      lineHeight: 21,
    },
    heading1: {
      color: colors.foreground,
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      marginTop: 12,
      marginBottom: 8,
    },
    heading2: {
      color: colors.foreground,
      fontSize: 18,
      fontFamily: 'Inter_600SemiBold',
      marginTop: 10,
      marginBottom: 6,
    },
    heading3: {
      color: colors.foreground,
      fontSize: 16,
      fontFamily: 'Inter_600SemiBold',
      marginTop: 8,
      marginBottom: 4,
    },
    paragraph: {
      color: colors.foreground,
      fontSize: 15,
      lineHeight: 21,
      marginTop: 0,
      marginBottom: 6,
    },
    strong: {
      color: colors.foreground,
      fontFamily: 'Inter_700Bold',
    },
    em: {
      color: colors.foreground,
      fontStyle: 'italic',
    },
    link: {
      color: colors.accent,
      textDecorationLine: 'underline',
    },
    blockquote: {
      backgroundColor: colors.overlay,
      borderLeftColor: colors.accent,
      borderLeftWidth: 3,
      paddingLeft: 12,
      paddingVertical: 4,
      marginVertical: 8,
    },
    code_inline: {
      backgroundColor: colors.secondary,
      color: colors.accent,
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      overflow: 'hidden',
    },
    fence: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    list_item: {
      color: colors.foreground,
      fontSize: 15,
      lineHeight: 21,
      marginBottom: 3,
    },
    bullet_list: {
      marginVertical: 4,
    },
    ordered_list: {
      marginVertical: 4,
    },
    bullet_list_icon: {
      color: colors.accent,
      fontSize: 14,
      marginRight: 8,
    },
    ordered_list_icon: {
      color: colors.accent,
      fontSize: 14,
      marginRight: 8,
    },
    hr: {
      backgroundColor: colors.secondary,
      height: 1,
      marginVertical: 12,
    },
    table: {
      borderColor: colors.secondary,
      borderWidth: 1,
      marginVertical: 8,
    },
    thead: {
      backgroundColor: colors.secondary,
    },
    th: {
      color: colors.foreground,
      fontFamily: 'Inter_600SemiBold',
      padding: 8,
      borderColor: colors.secondary,
    },
    td: {
      color: colors.foreground,
      padding: 8,
      borderColor: colors.secondary,
    },
    tr: {
      borderColor: colors.secondary,
    },
  }), [colors]);

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.ai.getStatus(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const aiConfigured = aiStatus?.configured !== false;
  const aiRateLimitPerMinute = aiStatus?.rate_limit_per_minute ?? 20;
  const aiRateLimitBurst = aiStatus?.rate_limit_burst ?? 5;

  // Fetch conversations list
  const { data: conversationsData } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api.chat.listConversations(),
    enabled: aiConfigured,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch current conversation messages
  const { data: currentConversation, isLoading: loadingMessages } = useQuery({
    queryKey: ['ai-conversation', activeConversationId],
    queryFn: () =>
      activeConversationId ? api.chat.getConversation(activeConversationId) : null,
    enabled: !!activeConversationId && aiConfigured,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: (title?: string) => api.chat.createConversation(title),
    onSuccess: (data) => {
      setActiveConversationId(data.conversation_id);
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (msg: string) => {
      // Only send conversation_id if it's a real UUID (not temp-)
      const realConversationId = activeConversationId && !activeConversationId.startsWith('temp-')
        ? activeConversationId
        : undefined;

      if (attachment) {
        const result = await api.chat.sendMessageWithAttachment({
          conversation_id: realConversationId,
          message: msg,
          file: attachment,
        });
        clearAttachment();
        return result;
      }

      try {
        const streamCallbacks: Parameters<typeof api.chat.sendMessageStream>[1] = {
          onDelta: (event) => {
            setIsTyping(false);
            setStreamingDraft((prev) => prev + event.content);
          },
        };
        if (__DEV__) {
          streamCallbacks.onStart = (event) => {
            if (event.trace_id) {
              console.debug(`[AI trace] stream start: ${event.trace_id}`);
            }
          };
          streamCallbacks.onTrace = (event) => {
            console.debug('[AI trace]', event);
          };
          streamCallbacks.onDone = (event) => {
            if (event.trace_id) {
              console.debug(`[AI trace] stream done: ${event.trace_id}`);
            }
          };
        }

        const result = await api.chat.sendMessageStream(
          {
            conversation_id: realConversationId,
            message: msg,
          },
          streamCallbacks
        );
        clearAttachment();
        return result;
      } catch (streamErr) {
        setStreamingDraft('');
        throw streamErr;
      }
    },
    onMutate: async (msg) => {
      pendingMutationRef.current = true;
      setIsTyping(true);
      setStreamingDraft('');
      setSendError(null);
      setLastFailedMessage(null);
      const now = new Date().toISOString();
      const optimisticMessageId = `temp-${Date.now()}`;
      const optimisticMessage: ChatMessage = {
        id: optimisticMessageId,
        conversation_id: activeConversationId ?? 'temp',
        role: 'user',
        content: msg,
        created_at: now,
      };

      // If we have an existing conversation (real or temp), add the message to it
      if (activeConversationId) {
        queryClient.setQueryData<ConversationWithMessages | null>(
          ['ai-conversation', activeConversationId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: [...(old.messages ?? []), optimisticMessage],
            };
          }
        );
        return { optimisticConversationId: activeConversationId, optimisticMessageId };
      }

      // New conversation - create optimistic temp conversation
      const optimisticConversationId = `temp-${Date.now()}`;
      const title = msg.trim().slice(0, 36) || t('newConversation') || 'New conversation';

      const optimisticConversation: Conversation = {
        id: optimisticConversationId,
        user_id: '',
        title,
        created_at: now,
        updated_at: now,
      };

      queryClient.setQueryData<ConversationWithMessages>(
        ['ai-conversation', optimisticConversationId],
        {
          conversation: optimisticConversation,
          messages: [optimisticMessage],
        }
      );

      queryClient.setQueryData<{ conversations: Conversation[] } | undefined>(
        ['ai-conversations'],
        (old) => {
          const current = old?.conversations ?? [];
          if (current.find((c) => c.id === optimisticConversationId)) {
            return old;
          }
          return {
            conversations: [optimisticConversation, ...current],
          };
        }
      );

      setActiveConversationId(optimisticConversationId);
      return { optimisticConversationId, optimisticMessageId };
    },
    onSuccess: (data, _msg, context) => {
      if (!data || !data.conversation_id || !data.message) {
        console.error('Invalid response from server:', data);
        clearStreamingState();
        return;
      }

      const serverConversationId = data.conversation_id;

      // Get temp data BEFORE removing it
      const tempData = context?.optimisticConversationId
        ? queryClient.getQueryData<ConversationWithMessages>([
            'ai-conversation',
            context.optimisticConversationId,
          ])
        : null;

      if (context?.optimisticConversationId && context.optimisticConversationId !== serverConversationId) {
        // Transfer temp conversation data to server conversation
        if (tempData) {
          // Preserve user messages and add the AI response
          const userMessages = tempData.messages.filter(m => m.role === 'user');
          queryClient.setQueryData<ConversationWithMessages>(
            ['ai-conversation', serverConversationId],
            {
              ...tempData,
              conversation: { ...tempData.conversation, id: serverConversationId },
              messages: [...userMessages, data.message],
            }
          );
        } else {
          // No temp data, just set the AI response
          queryClient.setQueryData<ConversationWithMessages>(
            ['ai-conversation', serverConversationId],
            {
              conversation: {
                id: serverConversationId,
                user_id: '',
                title: _msg.slice(0, 36),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              messages: [data.message],
            }
          );
        }

        // Clean up temp conversation
        queryClient.removeQueries({ queryKey: ['ai-conversation', context.optimisticConversationId] });

        // Update conversations list
        queryClient.setQueryData<{ conversations: Conversation[] } | undefined>(
          ['ai-conversations'],
          (old) => {
            if (!old) return old;
            const updated = old.conversations.map((conv) =>
              conv.id === context.optimisticConversationId
                ? { ...conv, id: serverConversationId }
                : conv
            );
            return { conversations: updated };
          }
        );
        setActiveConversationId(serverConversationId);
      } else {
        // Same conversation - just add the AI response
        queryClient.setQueryData<ConversationWithMessages | null>(
          ['ai-conversation', serverConversationId],
          (old) => {
            if (!old) return old;
            // Avoid duplicate messages
            if (old.messages.find((m) => m.id === data.message.id)) {
              return old;
            }
            return {
              ...old,
              messages: [...old.messages, data.message],
            };
          }
        );
      }

      // Sort messages by created_at to ensure correct order
      queryClient.setQueryData<ConversationWithMessages | null>(
        ['ai-conversation', serverConversationId],
        (old) => {
          if (!old) return old;
          const sorted = [...old.messages].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return { ...old, messages: sorted };
        }
      );

      // Invalidate to get fresh data from server
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      clearStreamingState();
      pendingMutationRef.current = false;
      lastSentMessageRef.current = ''; // Clear saved message on success
    },
    onError: (error, _msg, context) => {
      // Remove the optimistic user message on error
      if (context?.optimisticConversationId && context.optimisticMessageId) {
        queryClient.setQueryData<ConversationWithMessages | null>(
          ['ai-conversation', context.optimisticConversationId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.filter((msg) => msg.id !== context.optimisticMessageId),
            };
          }
        );
      }
      // If it was a temp conversation, remove it entirely
      if (context?.optimisticConversationId?.startsWith('temp-')) {
        queryClient.removeQueries({
          queryKey: ['ai-conversation', context.optimisticConversationId],
        });
        queryClient.setQueryData<{ conversations: Conversation[] } | undefined>(
          ['ai-conversations'],
          (old) => {
            if (!old) return old;
            return {
              conversations: old.conversations.filter(
                (conv) => conv.id !== context.optimisticConversationId
              ),
            };
          }
        );
        // Reset to no conversation
        setActiveConversationId(null);
      }
      // Save the failed message for retry
      setLastFailedMessage(_msg);
      // Restore the user's message so they can retry
      if (lastSentMessageRef.current) {
        setMessage(lastSentMessageRef.current);
      }
      setSendError(getFriendlyErrorMessage(error));
      clearStreamingState();
      pendingMutationRef.current = false;
    },
    onSettled: () => {
      // Always reset the pending mutation ref, even if the component is still mounted
      // This ensures the user can send messages again after success or error
      pendingMutationRef.current = false;
    },
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => api.chat.deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      if (activeConversationId) {
        setActiveConversationId(null);
      }
    },
  });

  const applyParsedMutation = useMutation({
    mutationFn: (data: SmartParseResponse) =>
      api.ai.applyParsed({
        amount: data.amount,
        currency: data.currency,
        type: data.type,
        description: data.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      updatePendingAction('transaction', { status: 'done' });
    },
    onError: (err) => {
      updatePendingAction('transaction', {
        status: 'error',
        error: toMutationErrorMessage(err, 'Could not add transaction'),
      });
    },
  });

  const applyRecurringMutation = useMutation({
    mutationFn: (data: { parsed: SmartParseResponse; frequency: string }) =>
      api.ai.applyRecurring({
        amount: data.parsed.amount,
        currency: data.parsed.currency,
        type: data.parsed.type,
        description: data.parsed.description,
        category: data.parsed.category,
        frequency: data.frequency,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      updatePendingAction('recurring', { status: 'done', result });
    },
    onError: (err) => {
      updatePendingAction('recurring', {
        status: 'error',
        error: toMutationErrorMessage(err, 'Could not create recurring transaction'),
      });
    },
  });

  const applyGoalContributionMutation = useMutation({
    mutationFn: (data: { amount: number; goalId: string; goalName?: string }) =>
      api.ai.applyGoalContribution({
        amount: data.amount,
        goal_id: data.goalId,
        goal_name: data.goalName,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      updatePendingAction('goal_contribution', { status: 'done', result });
    },
    onError: (err) => {
      updatePendingAction('goal_contribution', {
        status: 'error',
        error: toMutationErrorMessage(err, 'Could not contribute to goal'),
      });
    },
  });

  const walletConvertMutation = useMutation({
    mutationFn: (data: { from: string; to: string; amount: number }) =>
      api.wallet.convert({
        from_currency: data.from,
        to_currency: data.to,
        amount: data.amount,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      updatePendingAction('convert', { status: 'done' });
    },
    onError: (err) => {
      updatePendingAction('convert', {
        status: 'error',
        error: toMutationErrorMessage(err, 'Conversion failed'),
      });
    },
  });

  const messages: ChatMessage[] = currentConversation?.messages || [];
  const conversations: Conversation[] = conversationsData?.conversations || [];
  const hasTypedMessage = message.trim().length > 0;
  const canSendMessage =
    (hasTypedMessage || !!attachment) &&
    message.length <= MAX_MESSAGE_LENGTH &&
    !sendMessageMutation.isPending;
  const inputPlaceholder = attachment
    ? (t('addCaption') || 'Add optional caption...')
    : (t('typeMessage') || 'Type a message');

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  const maybeAutoScroll = useCallback(() => {
    if (isNearBottomRef.current) {
      scrollToBottom();
    }
  }, [scrollToBottom]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 40;
    isNearBottomRef.current =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  }, []);

  useEffect(() => {
    const timeout = setTimeout(maybeAutoScroll, 80);
    return () => clearTimeout(timeout);
  }, [messages, isTyping, streamingDraft, activeConversationId, maybeAutoScroll]);


  const handleSend = (overrideMessage?: string) => {
    const msgToSend = overrideMessage || message;
    const trimmed = msgToSend.trim();
    if ((!trimmed && !attachment) || sendMessageMutation.isPending || pendingMutationRef.current) return;
    if (msgToSend.length > MAX_MESSAGE_LENGTH) return;
    if (!aiConfigured) {
      setSendError('AI is not configured on the server.');
      return;
    }
    lastSentMessageRef.current = trimmed; // Save message for retry on error
    sendMessageMutation.mutate(trimmed);
    if (!overrideMessage) setMessage('');
    setLastFailedMessage(null);
    if (trimmed) {
      void maybeStartAction(trimmed);
    }
    isNearBottomRef.current = true;
    setTimeout(scrollToBottom, 50);
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      setSendError(null);
      handleSend(lastFailedMessage);
    }
  };

  const handleNewConversation = () => {
    if (createConversationMutation.isPending || sendMessageMutation.isPending) return;
    if (!aiConfigured) {
      setSendError('AI is not configured on the server.');
      return;
    }
    // Just reset to show welcome screen - conversation will be created when user sends first message
    setActiveConversationId(null);
    clearConversationTransientState();
    isNearBottomRef.current = true;
  };

  const handleSelectConversation = (id: string) => {
    if (sendMessageMutation.isPending) return; // Don't switch while sending
    clearStreamingState();
    setActiveConversationId(id);
    clearConversationTransientState();
    isNearBottomRef.current = true;
  };

  const maybeStartAction = async (text: string) => {
    // Step 1: Lightweight AI intent detection — fast model decides if this is actionable
    let intent: string;
    try {
      const intentResult = await api.ai.detectIntent({ text });
      intent = intentResult.intent;
    } catch {
      // If intent detection fails, skip action (let the chat response handle it)
      return;
    }

    // Not an actionable request — just a conversation/question
    if (intent === 'none') return;

    // Step 2: Full AI parsing to extract details (amount, currencies, etc.)
    setPendingAction({
      kind: intent === 'convert' ? 'convert'
        : intent === 'rate' ? 'rate'
        : 'transaction',
      status: 'loading',
      original: text,
      ...(intent === 'convert' ? { from: '', to: '', amount: 0 } : {}),
      ...(intent === 'rate' ? { from: '', to: '' } : {}),
    } as PendingAction);

    try {
      const parsed = await api.ai.smartParse({ text });

      // Model decided this is not actionable after full analysis
      if (parsed.action_type === 'none') {
        setPendingAction(null);
        return;
      }

      // Route to the appropriate UI based on the model's decision
      if (parsed.action_type === 'convert') {
        const from = parsed.from_currency || parsed.currency || 'USD';
        const to = parsed.to_currency || 'EUR';
        const amount = parsed.amount || 1;
        setPendingAction({
          kind: 'convert',
          status: 'loading',
          original: text,
          from,
          to,
          amount,
        });
        try {
          const result = await api.convert({ from, to, amount });
          setPendingAction({
            kind: 'convert',
            status: 'ready',
            original: text,
            from,
            to,
            amount,
            result,
          });
        } catch (err) {
          setPendingAction({
            kind: 'convert',
            status: 'error',
            original: text,
            from,
            to,
            amount,
            error: err instanceof Error ? err.message : 'Could not fetch conversion',
          });
        }
      } else if (parsed.action_type === 'rate') {
        const from = parsed.from_currency || parsed.currency || 'USD';
        const to = parsed.to_currency || 'EUR';
        setPendingAction({
          kind: 'rate',
          status: 'loading',
          original: text,
          from,
          to,
        });
        try {
          const result = await api.convert({ from, to, amount: 1 });
          setPendingAction({
            kind: 'rate',
            status: 'ready',
            original: text,
            from,
            to,
            result,
          });
        } catch (err) {
          setPendingAction({
            kind: 'rate',
            status: 'error',
            original: text,
            from,
            to,
            error: err instanceof Error ? err.message : 'Could not fetch rate',
          });
        }
      } else if (parsed.action_type === 'goal_contribution') {
        const goalsResponse = await api.goals.list();
        setPendingAction({
          kind: 'goal_contribution',
          status: 'ready',
          original: text,
          parsed,
          goals: goalsResponse.goals || [],
          selectedGoalId: undefined,
        });
      } else if (parsed.action_type === 'recurring') {
        setPendingAction({
          kind: 'recurring',
          status: 'ready',
          original: text,
          parsed,
          selectedFrequency: parsed.frequency || 'monthly',
        });
      } else {
        // transaction
        if (parsed.amount === 0) {
          setPendingAction(null);
          return;
        }
        setPendingAction({
          kind: 'transaction',
          status: 'ready',
          original: text,
          parsed,
        });
      }
    } catch (error) {
      setPendingAction({
        kind: 'transaction',
        status: 'error',
        original: text,
        error: error instanceof Error ? error.message : 'Could not parse message',
      });
    }
  };

  const renderSidebar = () => (
    <View
      style={{
        backgroundColor: colors.card,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        flexDirection: 'column',
        width: isDesktop ? 288 : 240,
        height: '100%',
      }}
    >
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable
          onPress={handleNewConversation}
          style={({ pressed }) => [{ backgroundColor: colors.primary, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
        >
          <Plus size={20} color={colors.primaryForeground} />
          <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>{t('newConversation')}</Text>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1, padding: 8 }}>
        {conversations.map((conv) => (
          <Pressable
            key={conv.id}
            onPress={() => handleSelectConversation(conv.id)}
            style={({ pressed }) => [{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 12,
              borderRadius: 12,
              marginBottom: 4,
              backgroundColor: conv.id === activeConversationId ? colors.primary + '33' : 'transparent',
            }, pressed && { opacity: 0.7 }]}
          >
            <MessageCircle
              size={16}
              color={
                conv.id === activeConversationId
                  ? colors.accent
                  : colors.placeholder
              }
            />
            <Text
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 14,
                color: conv.id === activeConversationId ? colors.accent : colors.foreground,
                fontFamily: conv.id === activeConversationId ? 'Inter_500Medium' : undefined,
              }}
              numberOfLines={1}
            >
              {conv.title}
            </Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Alert.alert(
                  t('deleteConversation') || 'Delete Conversation',
                  t('deleteConversationConfirm') || 'Are you sure you want to delete this conversation?',
                  [
                    { text: t('cancel') || 'Cancel', style: 'cancel' },
                    {
                      text: t('delete') || 'Delete',
                      style: 'destructive',
                      onPress: () => deleteConversationMutation.mutate(conv.id),
                    },
                  ]
                );
              }}
              hitSlop={10}
              style={({ pressed }) => [{ padding: 8 }, pressed && { opacity: 0.7 }]}
            >
              <Trash2 size={16} color={colors.danger} />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderWelcome = () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <View
        style={{
          width: '100%',
          maxWidth: 760,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 24,
          padding: isTablet ? 28 : 20,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 2,
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 74,
            height: 74,
            borderRadius: 24,
            backgroundColor: colors.primary + '22',
            borderWidth: 1,
            borderColor: colors.primary + '44',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <Sparkles size={32} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center', marginBottom: 8 }}>
          {t('aiWelcome') || 'How can I help with your money today?'}
        </Text>
        <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 20, maxWidth: 560, alignSelf: 'center', lineHeight: 22 }}>
          {t('aiWelcomeDesc') || 'Ask questions, attach receipts, or let me take actions like adding transactions and conversions.'}
        </Text>
      </View>
    </View>
  );

  const renderMessages = () => {
    const listEmptyContent = () => {
      if (loadingMessages && activeConversationId) {
        return (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        );
      }
      if (!aiConfigured) {
        return (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Sparkles size={24} color={colors.accent} />
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 12 }}>AI assistant is offline</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
              The server is missing an AI configuration. Please add an AI_API_KEY and redeploy.
            </Text>
          </View>
        );
      }
      return renderWelcome();
    };

    const footerContent = isTyping || pendingAction || streamingDraft ? (
      <View style={{ gap: 16 }}>
        {streamingDraft.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', width: '100%', alignItems: 'flex-start' }}>
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 13,
                paddingVertical: 9,
                borderRadius: 18,
                borderBottomLeftRadius: 6,
                maxWidth: Math.min(messageMaxWidth + 28, 560),
              }}
            >
              <Markdown style={markdownStyles}>
                {streamingDraft}
              </Markdown>
            </View>
          </View>
        )}

        {isTyping && !streamingDraft && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', width: '100%', alignItems: 'flex-end' }}>
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, borderBottomLeftRadius: 6, maxWidth: '90%' }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>Thinking…</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <View style={{ width: 8, height: 8, backgroundColor: colors.mutedForeground, borderRadius: 9999 }} />
                <View style={{ width: 8, height: 8, backgroundColor: colors.mutedForeground, borderRadius: 9999 }} />
                <View style={{ width: 8, height: 8, backgroundColor: colors.mutedForeground, borderRadius: 9999 }} />
              </View>
            </View>
          </View>
        )}

        {pendingAction && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', width: '100%', alignItems: 'flex-start' }}>
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, maxWidth: '92%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                    {pendingAction.kind === 'transaction'
                      ? 'Transaction assistant'
                      : pendingAction.kind === 'recurring'
                        ? 'Recurring transaction'
                        : pendingAction.kind === 'goal_contribution'
                          ? 'Goal contribution'
                          : pendingAction.kind === 'convert'
                            ? 'Conversion assistant'
                            : 'Live FX rate'}
                  </Text>
                  {pendingAction.status === 'done' && (
                    <CheckCircle2 size={16} color={colors.success} />
                  )}
                  {pendingAction.status === 'error' && (
                    <AlertTriangle size={16} color={colors.danger} />
                  )}
                </View>

                {pendingAction.status === 'loading' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={{ fontSize: 14, color: colors.mutedForeground, marginLeft: 8 }}>
                      {pendingAction.kind === 'transaction' || pendingAction.kind === 'recurring' || pendingAction.kind === 'goal_contribution'
                        ? 'Analyzing…'
                        : 'Fetching rate…'}
                    </Text>
                  </View>
                )}

                {pendingAction.status === 'error' && (
                  <Text style={{ fontSize: 14, color: colors.danger }}>
                    {pendingAction.error || 'Something went wrong.'}
                  </Text>
                )}

                {pendingAction.kind === 'transaction' && pendingAction.status === 'ready' && pendingAction.parsed && (
                  <>
                    {!editMode ? (
                      <>
                        {/* Preview Mode */}
                        <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: pendingAction.parsed.type === 'credit' ? colors.success + '33' : colors.danger + '33' }}>
                              <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: pendingAction.parsed.type === 'credit' ? colors.success : colors.danger }}>
                                {pendingAction.parsed.type === 'credit' ? 'Income' : 'Expense'}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                              {pendingAction.parsed.currency} {pendingAction.parsed.amount.toFixed(2)}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>
                            {pendingAction.parsed.description}
                          </Text>
                          {pendingAction.parsed.category && pendingAction.parsed.category !== 'other' && (
                            <Text style={{ fontSize: 12, color: colors.accent }}>
                              Category: {pendingAction.parsed.category}
                            </Text>
                          )}
                          {pendingAction.parsed.confidence < 0.8 && (
                            <View style={{ marginTop: 8, backgroundColor: colors.warning + '1A', padding: 8, borderRadius: 4 }}>
                              <Text style={{ fontSize: 12, color: colors.warning }}>
                                Low confidence ({(pendingAction.parsed.confidence * 100).toFixed(0)}%) - Please verify details
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          <Pressable
                            onPress={() => applyParsedMutation.mutate(pendingAction.parsed!)}
                            disabled={applyParsedMutation.isPending}
                            style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: applyParsedMutation.isPending ? 0.5 : pressed ? 0.7 : 1 }]}
                          >
                            <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                              {applyParsedMutation.isPending ? 'Adding...' : 'Add transaction'}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setEditAmount(pendingAction.parsed!.amount.toString());
                              setEditType(pendingAction.parsed!.type);
                              setEditCurrency(pendingAction.parsed!.currency);
                              setEditDescription(pendingAction.parsed!.description);
                              setEditMode(true);
                            }}
                            style={({ pressed }) => [{ backgroundColor: colors.secondary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                          >
                            <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Edit</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setPendingAction(null)}
                            style={({ pressed }) => [{ paddingHorizontal: 16, paddingVertical: 8 }, pressed && { opacity: 0.7 }]}
                          >
                            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Dismiss</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        {/* Edit Mode */}
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>Type</Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              onPress={() => setEditType('debit')}
                              style={({ pressed }) => [{ flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, backgroundColor: editType === 'debit' ? colors.danger + '33' : colors.muted, borderColor: editType === 'debit' ? colors.danger : colors.border }, pressed && { opacity: 0.7 }]}
                            >
                              <Text style={{ fontSize: 12, textAlign: 'center', fontFamily: 'Inter_600SemiBold', color: editType === 'debit' ? colors.danger : colors.mutedForeground }}>
                                Expense
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setEditType('credit')}
                              style={({ pressed }) => [{ flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, backgroundColor: editType === 'credit' ? colors.success + '33' : colors.muted, borderColor: editType === 'credit' ? colors.success : colors.border }, pressed && { opacity: 0.7 }]}
                            >
                              <Text style={{ fontSize: 12, textAlign: 'center', fontFamily: 'Inter_600SemiBold', color: editType === 'credit' ? colors.success : colors.mutedForeground }}>
                                Income
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                          <View style={{ flex: 2 }}>
                            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Amount</Text>
                            <TextInput
                              value={editAmount}
                              onChangeText={setEditAmount}
                              keyboardType="decimal-pad"
                              style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontSize: 14, outlineStyle: 'none' } as any}
                              placeholderTextColor={colors.mutedForeground}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Currency</Text>
                            <TextInput
                              value={editCurrency}
                              onChangeText={(text) => setEditCurrency(text.toUpperCase())}
                              maxLength={3}
                              style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontSize: 14, outlineStyle: 'none' } as any}
                              placeholderTextColor={colors.mutedForeground}
                            />
                          </View>
                        </View>
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Description</Text>
                          <TextInput
                            value={editDescription}
                            onChangeText={setEditDescription}
                            style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontSize: 14, outlineStyle: 'none' } as any}
                            placeholderTextColor={colors.mutedForeground}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          <Pressable
                            onPress={() => {
                              const parsedAmount = parseFloat(editAmount);
                              if (isNaN(parsedAmount) || parsedAmount <= 0) {
                                setSendError('Please enter a valid amount');
                                return;
                              }
                              applyParsedMutation.mutate({
                                amount: parsedAmount,
                                type: editType,
                                currency: editCurrency,
                                description: editDescription,
                                category: 'other',
                                action_type: 'transaction',
                                confidence: 1,
                              });
                              setEditMode(false);
                            }}
                            disabled={applyParsedMutation.isPending}
                            style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: applyParsedMutation.isPending ? 0.5 : pressed ? 0.7 : 1 }]}
                          >
                            <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                              {applyParsedMutation.isPending ? 'Adding...' : 'Confirm & Add'}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setEditMode(false)}
                            style={({ pressed }) => [{ backgroundColor: colors.secondary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                          >
                            <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </>
                )}

                {/* Recurring Transaction Card */}
                {pendingAction.kind === 'recurring' && pendingAction.status === 'ready' && pendingAction.parsed && (
                  <>
                    <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: pendingAction.parsed.type === 'credit' ? colors.success + '33' : colors.danger + '33' }}>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: pendingAction.parsed.type === 'credit' ? colors.success : colors.danger }}>
                            {pendingAction.parsed.type === 'credit' ? 'Recurring Income' : 'Recurring Expense'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                          {pendingAction.parsed.currency} {pendingAction.parsed.amount.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>
                        {pendingAction.parsed.description}
                      </Text>
                      {pendingAction.parsed.category && pendingAction.parsed.category !== 'other' && (
                        <Text style={{ fontSize: 12, color: colors.accent }}>
                          Category: {pendingAction.parsed.category}
                        </Text>
                      )}
                    </View>
                    {/* Frequency selector */}
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>Frequency</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {['daily', 'weekly', 'monthly', 'yearly'].map((freq) => (
                          <Pressable
                            key={freq}
                            onPress={() => setPendingAction(prev =>
                              prev?.kind === 'recurring' ? { ...prev, selectedFrequency: freq } : prev
                            )}
                            style={({ pressed }) => [{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                              borderWidth: 1,
                              backgroundColor: pendingAction.selectedFrequency === freq ? colors.primary + '33' : colors.muted,
                              borderColor: pendingAction.selectedFrequency === freq ? colors.primary : colors.border,
                            }, pressed && { opacity: 0.7 }]}
                          >
                            <Text style={{
                              fontSize: 12,
                              fontFamily: 'Inter_500Medium',
                              textTransform: 'capitalize',
                              color: pendingAction.selectedFrequency === freq ? colors.accent : colors.foreground,
                            }}>
                              {freq}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Pressable
                        onPress={() => applyRecurringMutation.mutate({
                          parsed: pendingAction.parsed!,
                          frequency: pendingAction.selectedFrequency || 'monthly',
                        })}
                        disabled={applyRecurringMutation.isPending}
                        style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: applyRecurringMutation.isPending ? 0.5 : pressed ? 0.7 : 1 }]}
                      >
                        <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                          {applyRecurringMutation.isPending ? 'Creating...' : 'Create recurring'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingAction(null)}
                        style={({ pressed }) => [{ paddingHorizontal: 16, paddingVertical: 8 }, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Dismiss</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {/* Goal Contribution Card */}
                {pendingAction.kind === 'goal_contribution' && pendingAction.status === 'ready' && pendingAction.parsed && (
                  <>
                    <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: colors.accent + '33' }}>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.accent }}>Goal Contribution</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                          {pendingAction.parsed.currency} {pendingAction.parsed.amount.toFixed(2)}
                        </Text>
                      </View>
                      {pendingAction.parsed.goal_name && (
                        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                          Detected goal: {pendingAction.parsed.goal_name}
                        </Text>
                      )}
                    </View>
                    {/* Goal selector */}
                    {pendingAction.goals && pendingAction.goals.length > 0 ? (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>Select goal to contribute to</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {pendingAction.goals.map((goal) => (
                              <Pressable
                                key={goal.id}
                                onPress={() => setPendingAction(prev =>
                                  prev?.kind === 'goal_contribution' ? { ...prev, selectedGoalId: goal.id } : prev
                                )}
                                style={({ pressed }) => [{
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  backgroundColor: pendingAction.selectedGoalId === goal.id ? colors.primary + '33' : colors.muted,
                                  borderColor: pendingAction.selectedGoalId === goal.id ? colors.primary : colors.border,
                                }, pressed && { opacity: 0.7 }]}
                              >
                                <Text style={{
                                  fontSize: 12,
                                  fontFamily: 'Inter_500Medium',
                                  color: pendingAction.selectedGoalId === goal.id ? colors.accent : colors.foreground,
                                }}>
                                  {goal.name}
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                                  {goal.currency} {goal.current_amount.toFixed(0)} / {goal.target_amount.toFixed(0)}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    ) : (
                      <View style={{ marginBottom: 12, backgroundColor: colors.warning + '1A', padding: 8, borderRadius: 4 }}>
                        <Text style={{ fontSize: 12, color: colors.warning }}>
                          No goals found. Create a goal first to contribute.
                        </Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Pressable
                        onPress={() => {
                          if (!pendingAction.selectedGoalId) {
                            Alert.alert('Select Goal', 'Please select a goal to contribute to');
                            return;
                          }
                          applyGoalContributionMutation.mutate({
                            amount: pendingAction.parsed!.amount,
                            goalId: pendingAction.selectedGoalId,
                            goalName: pendingAction.parsed!.goal_name,
                          });
                        }}
                        disabled={applyGoalContributionMutation.isPending || !pendingAction.selectedGoalId}
                        style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: applyGoalContributionMutation.isPending || !pendingAction.selectedGoalId ? 0.5 : pressed ? 0.7 : 1 }]}
                      >
                        <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                          {applyGoalContributionMutation.isPending ? 'Contributing...' : 'Contribute'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingAction(null)}
                        style={({ pressed }) => [{ paddingHorizontal: 16, paddingVertical: 8 }, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Dismiss</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {pendingAction.kind === 'convert' && pendingAction.status === 'ready' && pendingAction.result && (
                  <>
                    <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                        {pendingAction.amount} {pendingAction.from} →{' '}
                        {formatNumber(pendingAction.result.result, 2)} {pendingAction.to}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4 }}>
                        Rate: {formatNumber(pendingAction.result.rate, 4)} {pendingAction.to}/{pendingAction.from}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={() =>
                          walletConvertMutation.mutate({
                            from: pendingAction.from,
                            to: pendingAction.to,
                            amount: pendingAction.amount,
                          })
                        }
                        style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                          Convert in wallet
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingAction(null)}
                        style={({ pressed }) => [{ backgroundColor: colors.secondary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Dismiss</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {pendingAction.kind === 'rate' && pendingAction.status === 'ready' && pendingAction.result && (
                  <>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                      1 {pendingAction.from} = {formatNumber(pendingAction.result.rate, 4)} {pendingAction.to}
                    </Text>
                    <Pressable
                      onPress={() => setPendingAction(null)}
                      style={({ pressed }) => [{ backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginTop: 12, alignSelf: 'flex-start' }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Dismiss</Text>
                    </Pressable>
                  </>
                )}

                {pendingAction.status === 'done' && (
                  <Text style={{ fontSize: 14, color: colors.success }}>
                    {pendingAction.kind === 'transaction'
                      ? t('transactionAdded') || 'Transaction added.'
                      : pendingAction.kind === 'recurring'
                        ? t('recurringCreated') || 'Recurring transaction created.'
                        : pendingAction.kind === 'goal_contribution'
                          ? t('contributionAdded') || 'Contribution added to goal.'
                          : pendingAction.kind === 'convert'
                            ? t('conversionCompleted') || 'Conversion completed.'
                            : t('rateUpdated') || 'Rate updated.'}
                  </Text>
                )}
              </View>
            </View>
        )}
      </View>
    ) : null;

    return (
      <FlatList
        ref={scrollViewRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item: msg, index }) => {
          const isUser = msg.role === 'user';
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
          const groupedWithPrev = previousMessage?.role === msg.role;
          const groupedWithNext = nextMessage?.role === msg.role;
          const baseRadius = 18;
          const chainRadius = 12;
          const tailRadius = 6;

          return (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                width: '100%',
                marginTop: index === 0 ? 0 : groupedWithPrev ? 4 : 12,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 9,
                  borderRadius: baseRadius,
                  backgroundColor: isUser ? colors.primary : colors.card,
                  borderWidth: isUser ? 0 : 1,
                  borderColor: isUser ? 'transparent' : colors.border,
                  borderTopLeftRadius: isUser
                    ? (groupedWithPrev ? chainRadius : baseRadius)
                    : (groupedWithPrev ? chainRadius : baseRadius),
                  borderTopRightRadius: isUser
                    ? (groupedWithPrev ? chainRadius : baseRadius)
                    : (groupedWithPrev ? chainRadius : baseRadius),
                  borderBottomRightRadius: isUser
                    ? (groupedWithNext ? chainRadius : tailRadius)
                    : (groupedWithNext ? chainRadius : baseRadius),
                  borderBottomLeftRadius: isUser
                    ? (groupedWithNext ? chainRadius : baseRadius)
                    : (groupedWithNext ? chainRadius : tailRadius),
                  maxWidth: isUser
                    ? Math.min(messageMaxWidth, 500)
                    : Math.min(messageMaxWidth + 28, 560),
                }}
              >
                {isUser ? (
                  <Text style={{ color: colors.primaryForeground, fontSize: 15, lineHeight: 21 }}>
                    {msg.content}
                  </Text>
                ) : (
                  <Markdown style={markdownStyles}>
                    {msg.content}
                  </Markdown>
                )}
              </View>
            </View>
          );
        }}
        style={contentWidthStyle}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={maybeAutoScroll}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 122,
          flexGrow: messages.length === 0 ? 1 : undefined,
          justifyContent: messages.length === 0 ? 'center' : 'flex-start',
        }}
        ListEmptyComponent={listEmptyContent}
        ListFooterComponent={footerContent}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 12) : 0}
      >
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* Sidebar for Desktop */}
          {showSidebar && renderSidebar()}

          {/* Main Chat Area */}
          <View style={{ flex: 1, flexDirection: 'column' }}>
            {/* Header */}
            <View
              style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background }, contentWidthStyle]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{t('aiAdvisor')}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 1 }}>
                    {aiConfigured
                      ? `${t('alwaysReady') || 'Always ready'} · ${aiRateLimitPerMinute}/min`
                      : 'Offline'}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleNewConversation}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.secondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 9999,
                    flexDirection: 'row',
                    alignItems: 'center',
                  },
                  pressed && { opacity: 0.74 },
                ]}
              >
                <Plus size={14} color={colors.foreground} />
                <Text style={{ fontSize: 12, color: colors.foreground, marginLeft: 6 }}>{t('newChat') || 'New Chat'}</Text>
              </Pressable>
            </View>

            {/* Mobile Conversations Carousel */}
            {!showSidebar && conversations.length > 0 && (
              <View style={contentWidthStyle}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                  contentContainerStyle={{ padding: 12, gap: 8 }}
                >
                  <Pressable
                    onPress={handleNewConversation}
                    style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.7 }]}
                  >
                    <Plus size={16} color={colors.primaryForeground} />
                    <Text style={{ color: colors.primaryForeground, fontSize: 14, marginLeft: 4 }}>{t('newConversation')}</Text>
                  </Pressable>
                  {conversations.map((conv) => (
                    <Pressable
                      key={conv.id}
                      onPress={() => handleSelectConversation(conv.id)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 9999,
                        backgroundColor: conv.id === activeConversationId ? colors.primary + '33' : colors.card,
                        borderWidth: conv.id === activeConversationId ? 1 : 0,
                        borderColor: conv.id === activeConversationId ? colors.accent : undefined,
                      }, pressed && { opacity: 0.7 }]}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          color: conv.id === activeConversationId ? colors.accent : colors.foreground,
                        }}
                        numberOfLines={1}
                      >
                        {conv.title.length > 20 ? conv.title.slice(0, 20) + '...' : conv.title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Messages */}
            {renderMessages()}

            {/* Input */}
            <View
              style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.background }}
            >
              {sendError && (
                <View style={{ backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger + '33', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.danger, fontSize: 12, flex: 1 }}>{sendError}</Text>
                    {lastFailedMessage && (
                      <Pressable
                        onPress={handleRetry}
                        disabled={sendMessageMutation.isPending}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.danger + '20',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                          marginLeft: 8,
                        }}
                      >
                        <RotateCcw size={12} color={colors.danger} />
                        <Text style={{ color: colors.danger, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginLeft: 4 }}>
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
                {isRecordingVoice && (
                  <VoiceRecorder
                    onRecordingComplete={handleVoiceComplete}
                    onCancel={cancelVoice}
                  />
                )}

                {/* Attachment Preview */}
                {attachment && !isRecordingVoice && (
                  <AttachmentPreview attachment={attachment} onRemove={clearAttachment} />
                )}

                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                  {!isRecordingVoice && (
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
                      <AttachmentButton onPress={showAttachmentPicker} />
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
                        onChangeText={(text) => setMessage(text.slice(0, MAX_MESSAGE_LENGTH))}
                        placeholder={inputPlaceholder}
                        placeholderTextColor={colors.mutedForeground}
                        multiline
                        editable={!sendMessageMutation.isPending}
                        maxLength={MAX_MESSAGE_LENGTH}
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
                    {message.length > CHAR_COUNT_THRESHOLD && (
                      <Text style={{
                        textAlign: 'right',
                        marginTop: 4,
                        marginRight: 4,
                        fontSize: 10,
                        color: message.length >= MAX_MESSAGE_LENGTH ? colors.danger : colors.mutedForeground,
                      }}>
                        {message.length}/{MAX_MESSAGE_LENGTH}
                      </Text>
                    )}
                  </View>

                  <Pressable
                    onPress={() => handleSend()}
                    disabled={!canSendMessage}
                    style={({ pressed }) => [{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.primary,
                      opacity: !canSendMessage ? 0.45 : pressed ? 0.72 : 1,
                    }]}
                  >
                    {sendMessageMutation.isPending ? (
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
