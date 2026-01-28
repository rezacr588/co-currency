import { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  User,
  Send,
  Plus,
  Trash2,
  Sparkles,
  MessageCircle,
  Paperclip,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import type { ChatMessage, Conversation, ConversationWithMessages } from '../../../../src/api/chat';
import type { AIParseResponse } from '../../../../src/types/wallet';
import type { ConversionResult } from '../../../../src/types/currency';
import { formatNumber } from '../../../../src/utils/format';

const suggestedQuestions = [
  'How am I doing financially?',
  'What are my top spending categories?',
  'Am I on track with my savings goals?',
  'How can I save more money?',
  'How much did I spend this month?',
];

const suggestedActions = [
  'Add $12 coffee',
  'Convert 100 USD to EUR',
  'Rate USD to EUR',
];

type PendingAction =
  | {
      kind: 'transaction';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      parsed?: AIParseResponse;
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
  const [showAttachmentHint, setShowAttachmentHint] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId || null
  );
  const scrollViewRef = useRef<FlatList<ChatMessage>>(null);
  const streamingStateRef = useRef<{ conversationId: string; messageId: string } | null>(null);
  const optimisticConversationIdRef = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.ai.getStatus(),
  });

  const aiConfigured = aiStatus?.configured !== false;

  // Fetch conversations list
  const { data: conversationsData } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api.chat.listConversations(),
    enabled: aiConfigured,
  });

  // Fetch current conversation messages
  const { data: currentConversation, isLoading: loadingMessages } = useQuery({
    queryKey: ['ai-conversation', activeConversationId],
    queryFn: () =>
      activeConversationId ? api.chat.getConversation(activeConversationId) : null,
    enabled: !!activeConversationId && aiConfigured,
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
      const conversationId = activeConversationId || undefined;
      const optimisticConversationId =
        optimisticConversationIdRef.current || activeConversationId || '';

      try {
        return await api.chat.streamMessage(
          {
            conversation_id: conversationId,
            message: msg,
          },
          {
            onDelta: (chunk) => {
              if (!optimisticConversationId) return;
              appendStreamingChunk(optimisticConversationId, chunk);
            },
          }
        );
      } catch {
        return api.chat.sendMessage({
          conversation_id: conversationId,
          message: msg,
        });
      }
    },
    onMutate: async (msg) => {
      setIsTyping(true);
      setSendError(null);
      const now = new Date().toISOString();
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: activeConversationId ?? 'temp',
        role: 'user',
        content: msg,
        created_at: now,
      };

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
        optimisticConversationIdRef.current = activeConversationId;
        return { optimisticConversationId: activeConversationId };
      }

      const optimisticConversationId = `temp-${Date.now()}`;
      const title =
        msg.trim().slice(0, 36) || t('newConversation') || 'New conversation';

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
      optimisticConversationIdRef.current = optimisticConversationId;
      return { optimisticConversationId };
    },
    onSuccess: (data, _msg, context) => {
      const serverConversationId = data.conversation_id;
      if (context?.optimisticConversationId && context.optimisticConversationId !== serverConversationId) {
        const tempData = queryClient.getQueryData<ConversationWithMessages>([
          'ai-conversation',
          context.optimisticConversationId,
        ]);
        if (tempData) {
          queryClient.setQueryData<ConversationWithMessages>(
            ['ai-conversation', serverConversationId],
            tempData
          );
          queryClient.removeQueries({ queryKey: ['ai-conversation', context.optimisticConversationId] });
        }

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
        if (streamingStateRef.current?.conversationId === context.optimisticConversationId) {
          streamingStateRef.current = {
            conversationId: serverConversationId,
            messageId: streamingStateRef.current.messageId,
          };
        }
      }

      finalizeStreamingAssistant(serverConversationId, data.message);
      setIsTyping(false);
    },
    onError: (error, _msg, context) => {
      if (context?.optimisticConversationId?.startsWith('temp-')) {
        queryClient.removeQueries({
          queryKey: ['ai-conversation', context.optimisticConversationId],
        });
      }
      streamingStateRef.current = null;
      setSendError(error instanceof Error ? error.message : 'Unable to reach the assistant. Please try again.');
      setIsTyping(false);
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
    mutationFn: (data: AIParseResponse) =>
      api.ai.applyParsed({
        amount: data.amount,
        currency: data.currency,
        type: data.type,
        description: data.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setPendingAction((current) =>
        current && current.kind === 'transaction'
          ? { ...current, status: 'done' }
          : current
      );
    },
    onError: (err) => {
      setPendingAction((current) =>
        current && current.kind === 'transaction'
          ? {
              ...current,
              status: 'error',
              error: err instanceof Error ? err.message : 'Could not add transaction',
            }
          : current
      );
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
      setPendingAction((current) =>
        current && current.kind === 'convert'
          ? { ...current, status: 'done' }
          : current
      );
    },
    onError: (err) => {
      setPendingAction((current) =>
        current && current.kind === 'convert'
          ? {
              ...current,
              status: 'error',
              error: err instanceof Error ? err.message : 'Conversion failed',
            }
          : current
      );
    },
  });

  const messages: ChatMessage[] = currentConversation?.messages || [];
  const conversations: Conversation[] = conversationsData?.conversations || [];

  const ensureStreamingAssistant = (conversationId: string) => {
    const existing = streamingStateRef.current;
    if (existing && existing.conversationId === conversationId) {
      return existing;
    }
    const messageId = `stream-${Date.now()}`;
    const now = new Date().toISOString();
    streamingStateRef.current = { conversationId, messageId };

    queryClient.setQueryData<ConversationWithMessages | null>(
      ['ai-conversation', conversationId],
      (old) => {
        const base = old ?? {
          conversation: {
            id: conversationId,
            user_id: '',
            title: t('newConversation') || 'Conversation',
            created_at: now,
            updated_at: now,
          },
          messages: [],
        };
        return {
          ...base,
          messages: [
            ...base.messages,
            {
              id: messageId,
              conversation_id: conversationId,
              role: 'assistant',
              content: '',
              created_at: now,
            },
          ],
        };
      }
    );

    return streamingStateRef.current;
  };

  const appendStreamingChunk = (conversationId: string, chunk: string) => {
    const streamingState = ensureStreamingAssistant(conversationId);
    queryClient.setQueryData<ConversationWithMessages | null>(
      ['ai-conversation', conversationId],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) =>
            msg.id === streamingState.messageId
              ? { ...msg, content: `${msg.content}${chunk}` }
              : msg
          ),
        };
      }
    );
  };

  const finalizeStreamingAssistant = (conversationId: string, message: ChatMessage) => {
    const streamingState = streamingStateRef.current;
    queryClient.setQueryData<ConversationWithMessages | null>(
      ['ai-conversation', conversationId],
      (old) => {
        if (!old) return old;
        let messages = old.messages;
        if (streamingState && streamingState.conversationId === conversationId) {
          messages = messages.filter((msg) => msg.id !== streamingState.messageId);
        }
        if (!messages.find((msg) => msg.id === message.id)) {
          messages = [...messages, message];
        }
        return { ...old, messages };
      }
    );
    if (streamingState && streamingState.conversationId === conversationId) {
      streamingStateRef.current = null;
    }
  };

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
  }, [messages, isTyping, activeConversationId, maybeAutoScroll]);


  const handleSend = () => {
    if (!message.trim() || sendMessageMutation.isPending) return;
    if (!aiConfigured) {
      setSendError('AI is not configured on the server.');
      return;
    }
    const trimmed = message.trim();
    sendMessageMutation.mutate(trimmed);
    setMessage('');
    void maybeStartAction(trimmed);
    setShowAttachmentHint(false);
    isNearBottomRef.current = true;
    setTimeout(scrollToBottom, 50);
  };

  const handleNewConversation = () => {
    if (createConversationMutation.isPending) return;
    if (!aiConfigured) {
      setSendError('AI is not configured on the server.');
      return;
    }
    createConversationMutation.mutate(t('newConversation') || 'New conversation');
    setPendingAction(null);
    streamingStateRef.current = null;
    isNearBottomRef.current = true;
  };

  const handleSelectConversation = (id: string) => {
    setIsTyping(false);
    setActiveConversationId(id);
    setPendingAction(null);
    streamingStateRef.current = null;
    isNearBottomRef.current = true;
  };

  const parseConvertIntent = (text: string) => {
    const match = text.match(
      /(?:convert|exchange)\s+([\d.,]+)\s*([A-Za-z]{3})\s*(?:to|into|in)\s*([A-Za-z]{3})/i
    );
    if (!match) return null;
    const amount = parseFloat(match[1].replace(/,/g, ''));
    const from = match[2].toUpperCase();
    const to = match[3].toUpperCase();
    if (!amount || !from || !to) return null;
    return { amount, from, to };
  };

  const parseRateIntent = (text: string) => {
    const match = text.match(
      /(?:rate|fx|price)\s+([A-Za-z]{3})\s*(?:to|\/|in)\s*([A-Za-z]{3})/i
    );
    if (!match) return null;
    return { from: match[1].toUpperCase(), to: match[2].toUpperCase() };
  };

  const looksLikeTransaction = (text: string) =>
    /(spent|paid|bought|buy|purchase|income|received|earned|add)/i.test(text);

  const maybeStartAction = async (text: string) => {
    const convert = parseConvertIntent(text);
    if (convert) {
      setPendingAction({
        kind: 'convert',
        status: 'loading',
        original: text,
        ...convert,
      });
      try {
        const result = await api.convert({
          from: convert.from,
          to: convert.to,
          amount: convert.amount,
        });
        setPendingAction({
          kind: 'convert',
          status: 'ready',
          original: text,
          ...convert,
          result,
        });
      } catch (error) {
        setPendingAction({
          kind: 'convert',
          status: 'error',
          original: text,
          ...convert,
          error: error instanceof Error ? error.message : 'Could not fetch conversion',
        });
      }
      return;
    }

    const rate = parseRateIntent(text);
    if (rate) {
      setPendingAction({
        kind: 'rate',
        status: 'loading',
        original: text,
        ...rate,
      });
      try {
        const result = await api.convert({ from: rate.from, to: rate.to, amount: 1 });
        setPendingAction({
          kind: 'rate',
          status: 'ready',
          original: text,
          ...rate,
          result,
        });
      } catch (error) {
        setPendingAction({
          kind: 'rate',
          status: 'error',
          original: text,
          ...rate,
          error: error instanceof Error ? error.message : 'Could not fetch rate',
        });
      }
      return;
    }

    if (looksLikeTransaction(text)) {
      setPendingAction({
        kind: 'transaction',
        status: 'loading',
        original: text,
      });
      try {
        const parsed = await api.ai.parseReceipt({ text });
        setPendingAction({
          kind: 'transaction',
          status: 'ready',
          original: text,
          parsed,
        });
      } catch (error) {
        setPendingAction({
          kind: 'transaction',
          status: 'error',
          original: text,
          error: error instanceof Error ? error.message : 'Could not parse transaction',
        });
      }
    }
  };

  const renderSidebar = () => (
    <View
      className="bg-card border-r border-border flex-col"
      style={{
        width: isDesktop ? 288 : 240,
        height: '100%',
      }}
    >
      <View className="p-4 border-b border-border">
        <Pressable
          onPress={handleNewConversation}
          className="bg-primary p-3 rounded-xl flex-row items-center justify-center"
          style={{ cursor: 'pointer' }}
        >
          <Plus size={20} color="#09090b" />
          <Text className="text-primary-foreground font-semibold ml-2">{t('newConversation')}</Text>
        </Pressable>
      </View>
      <ScrollView className="flex-1 p-2">
        {conversations.map((conv) => (
          <Pressable
            key={conv.id}
            onPress={() => handleSelectConversation(conv.id)}
            className={`flex-row items-center p-3 rounded-xl mb-1 ${
              conv.id === activeConversationId
                ? 'bg-primary/20'
                : 'active:bg-secondary/50'
            }`}
            style={{ cursor: 'pointer' }}
          >
            <MessageCircle
              size={16}
              color={
                conv.id === activeConversationId
                  ? 'rgb(212, 175, 55)'
                  : 'rgb(148, 163, 184)'
              }
            />
            <Text
              className={`flex-1 ml-2 text-sm ${
                conv.id === activeConversationId
                  ? 'text-accent font-medium'
                  : 'text-foreground'
              }`}
              numberOfLines={1}
            >
              {conv.title}
            </Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                deleteConversationMutation.mutate(conv.id);
              }}
              className="p-2"
              hitSlop={10}
              style={{ cursor: 'pointer' }}
            >
              <Trash2 size={16} color="rgb(220, 38, 38)" />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderWelcome = () => (
    <View className="flex-1 items-center justify-center p-6">
      <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-4">
        <Sparkles size={32} color="#09090b" />
      </View>
      <Text className="text-xl font-bold text-foreground text-center mb-2">
        {t('aiWelcome')}
      </Text>
      <Text className="text-muted-foreground text-center mb-6 max-w-md">
        {t('aiWelcomeDesc')}
      </Text>
      <View className="flex-row flex-wrap justify-center gap-2 mb-5">
        {suggestedActions.map((action, i) => (
          <Pressable
            key={i}
            onPress={() => setMessage(action)}
            className="bg-secondary border border-border px-4 py-2 rounded-full"
            style={{ cursor: 'pointer' }}
          >
            <Text className="text-foreground text-sm">{action}</Text>
          </Pressable>
        ))}
      </View>
      <View
        className="flex-row flex-wrap justify-center gap-2"
        style={{ maxWidth: contentMaxWidth ?? 500 }}
      >
        {suggestedQuestions.map((q, i) => (
          <Pressable
            key={i}
            onPress={() => setMessage(q)}
            className="bg-card border border-border px-4 py-2 rounded-full active:border-accent"
            style={{ cursor: 'pointer' }}
          >
            <Text className="text-foreground text-sm">{q}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderMessages = () => {
    const listEmptyContent = () => {
      if (loadingMessages && activeConversationId) {
        return (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
          </View>
        );
      }
      if (!aiConfigured) {
        return (
          <View className="bg-card border border-border rounded-2xl p-6 items-center">
            <Sparkles size={24} color="rgb(212, 175, 55)" />
            <Text className="text-foreground font-semibold mt-3">AI assistant is offline</Text>
            <Text className="text-muted-foreground text-sm text-center mt-2">
              The server is missing an AI configuration. Please add an AI_API_KEY and redeploy.
            </Text>
          </View>
        );
      }
      return renderWelcome();
    };

    const footerContent = isTyping || pendingAction ? (
      <View style={{ gap: 16 }}>
        {isTyping && (
          <View className="flex-row justify-start" style={{ width: '100%' }}>
            <View className="flex-row" style={{ gap: 12, maxWidth: messageMaxWidth }}>
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                <Bot size={16} color="#09090b" />
              </View>
              <View className="bg-card px-4 py-3 rounded-2xl rounded-bl-sm">
                <View className="flex-row" style={{ gap: 4 }}>
                  <View className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                  <View className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                  <View className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                </View>
              </View>
            </View>
          </View>
        )}

        {pendingAction && (
          <View className="flex-row justify-start" style={{ width: '100%' }}>
            <View className="flex-row" style={{ gap: 12, maxWidth: messageMaxWidth }}>
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                <Sparkles size={16} color="#09090b" />
              </View>
              <View className="bg-card border border-border rounded-2xl px-4 py-3 flex-1">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-semibold text-foreground">
                    {pendingAction.kind === 'transaction'
                      ? 'Transaction assistant'
                      : pendingAction.kind === 'convert'
                        ? 'Conversion assistant'
                        : 'Live FX rate'}
                  </Text>
                  {pendingAction.status === 'done' && (
                    <CheckCircle2 size={16} color="#22c55e" />
                  )}
                  {pendingAction.status === 'error' && (
                    <AlertTriangle size={16} color="#ef4444" />
                  )}
                </View>

                {pendingAction.status === 'loading' && (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="rgb(212, 175, 55)" />
                    <Text className="text-sm text-muted-foreground ml-2">
                      {pendingAction.kind === 'transaction'
                        ? 'Analyzing…'
                        : 'Fetching rate…'}
                    </Text>
                  </View>
                )}

                {pendingAction.status === 'error' && (
                  <Text className="text-sm text-danger">
                    {pendingAction.error || 'Something went wrong.'}
                  </Text>
                )}

                {pendingAction.kind === 'transaction' && pendingAction.status === 'ready' && pendingAction.parsed && (
                  <>
                    <View className="bg-muted border border-border rounded-xl p-3 mb-3">
                      <Text className="text-sm font-semibold text-foreground">
                        {pendingAction.parsed.type === 'credit' ? 'Income' : 'Expense'} ·{' '}
                        {pendingAction.parsed.currency} {pendingAction.parsed.amount}
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-1">
                        {pendingAction.parsed.description}
                      </Text>
                    </View>
                    <View className="flex-row" style={{ gap: 8 }}>
                      <Pressable
                        onPress={() => applyParsedMutation.mutate(pendingAction.parsed!)}
                        className="bg-primary px-4 py-2 rounded-lg"
                        style={{ cursor: 'pointer' }}
                      >
                        <Text className="text-primary-foreground text-sm font-semibold">
                          Add transaction
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingAction(null)}
                        className="bg-secondary px-4 py-2 rounded-lg border border-border"
                        style={{ cursor: 'pointer' }}
                      >
                        <Text className="text-foreground text-sm font-semibold">Dismiss</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {pendingAction.kind === 'convert' && pendingAction.status === 'ready' && pendingAction.result && (
                  <>
                    <View className="bg-muted border border-border rounded-xl p-3 mb-3">
                      <Text className="text-sm font-semibold text-foreground">
                        {pendingAction.amount} {pendingAction.from} →{' '}
                        {formatNumber(pendingAction.result.result, 2)} {pendingAction.to}
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-1">
                        Rate: {formatNumber(pendingAction.result.rate, 4)} {pendingAction.to}/{pendingAction.from}
                      </Text>
                    </View>
                    <View className="flex-row" style={{ gap: 8 }}>
                      <Pressable
                        onPress={() =>
                          walletConvertMutation.mutate({
                            from: pendingAction.from,
                            to: pendingAction.to,
                            amount: pendingAction.amount,
                          })
                        }
                        className="bg-primary px-4 py-2 rounded-lg"
                        style={{ cursor: 'pointer' }}
                      >
                        <Text className="text-primary-foreground text-sm font-semibold">
                          Convert in wallet
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingAction(null)}
                        className="bg-secondary px-4 py-2 rounded-lg border border-border"
                        style={{ cursor: 'pointer' }}
                      >
                        <Text className="text-foreground text-sm font-semibold">Dismiss</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {pendingAction.kind === 'rate' && pendingAction.status === 'ready' && pendingAction.result && (
                  <>
                    <Text className="text-sm font-semibold text-foreground">
                      1 {pendingAction.from} = {formatNumber(pendingAction.result.rate, 4)} {pendingAction.to}
                    </Text>
                    <Pressable
                      onPress={() => setPendingAction(null)}
                      className="bg-secondary px-3 py-2 rounded-lg border border-border mt-3 self-start"
                      style={{ cursor: 'pointer' }}
                    >
                      <Text className="text-foreground text-sm font-semibold">Dismiss</Text>
                    </Pressable>
                  </>
                )}

                {pendingAction.status === 'done' && (
                  <Text className="text-sm text-success">
                    {pendingAction.kind === 'transaction'
                      ? 'Transaction added.'
                      : pendingAction.kind === 'convert'
                        ? 'Conversion completed.'
                        : 'Rate updated.'}
                  </Text>
                )}
              </View>
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
        renderItem={({ item: msg }) => (
          <View
            className={`flex-row ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
            style={{ width: '100%' }}
          >
            <View
              className={`flex-row ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              style={{ gap: 12, maxWidth: messageMaxWidth }}
            >
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  msg.role === 'user' ? 'bg-secondary' : 'bg-primary'
                }`}
              >
                {msg.role === 'user' ? (
                  <User size={16} color="rgb(148, 163, 184)" />
                ) : (
                  <Bot size={16} color="#09090b" />
                )}
              </View>
              <View
                className={`px-4 py-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-primary rounded-br-sm'
                    : 'bg-card rounded-bl-sm'
                }`}
              >
                <Text
                  className={`text-sm ${
                    msg.role === 'user' ? 'text-primary-foreground' : 'text-foreground'
                  }`}
                >
                  {msg.content}
                </Text>
              </View>
            </View>
          </View>
        )}
        style={contentWidthStyle}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={maybeAutoScroll}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          gap: 16,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 16) + 96,
          flexGrow: messages.length === 0 ? 1 : undefined,
          justifyContent: messages.length === 0 ? 'center' : 'flex-start',
        }}
        ListEmptyComponent={listEmptyContent}
        ListFooterComponent={footerContent}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 12) : 0}
      >
        <View className="flex-1 flex-row">
          {/* Sidebar for Desktop */}
          {showSidebar && renderSidebar()}

          {/* Main Chat Area */}
          <View className="flex-1 flex-col">
            {/* Header */}
            <View
              className="flex-row items-center p-4 border-b border-border bg-card"
              style={contentWidthStyle}
            >
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                <Bot size={16} color="#09090b" />
              </View>
              <View className="ml-3">
                <Text className="font-semibold text-foreground">{t('aiAdvisor')}</Text>
                <Text className="text-xs text-muted-foreground">{t('aiAdvisorDesc')}</Text>
              </View>
            </View>

            {/* Mobile Conversations Carousel */}
            {!showSidebar && conversations.length > 0 && (
              <View style={contentWidthStyle}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="border-b border-border"
                  contentContainerStyle={{ padding: 12, gap: 8 }}
                >
                  <Pressable
                    onPress={handleNewConversation}
                    className="bg-primary px-4 py-2 rounded-full flex-row items-center"
                    style={{ cursor: 'pointer' }}
                  >
                    <Plus size={16} color="#09090b" />
                    <Text className="text-primary-foreground text-sm ml-1">{t('newConversation')}</Text>
                  </Pressable>
                  {conversations.map((conv) => (
                    <Pressable
                      key={conv.id}
                      onPress={() => handleSelectConversation(conv.id)}
                      className={`px-4 py-2 rounded-full ${
                        conv.id === activeConversationId
                          ? 'bg-primary/20 border border-accent'
                          : 'bg-card'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      <Text
                        className={`text-sm ${
                          conv.id === activeConversationId
                            ? 'text-accent'
                            : 'text-foreground'
                        }`}
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
              className="p-4 border-t border-border bg-card"
              style={[contentWidthStyle, { paddingBottom: Math.max(insets.bottom, 12) }]}
            >
              {sendError && (
                <View className="bg-danger-muted border border-danger/20 p-3 rounded-lg mb-3">
                  <Text className="text-danger text-xs">{sendError}</Text>
                </View>
              )}
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <View className="flex-row items-center bg-muted px-3 py-1.5 rounded-full border border-border">
                    <ImageIcon size={14} color="rgb(161, 161, 170)" />
                    <Text className="text-xs text-muted-foreground ml-2">Images</Text>
                  </View>
                  <View className="flex-row items-center bg-muted px-3 py-1.5 rounded-full border border-border">
                    <FileText size={14} color="rgb(161, 161, 170)" />
                    <Text className="text-xs text-muted-foreground ml-2">Files</Text>
                  </View>
                </View>
                <Text className="text-xs text-muted-foreground">Coming soon</Text>
              </View>

              <View className="flex-row items-center" style={{ gap: 12 }}>
                <Pressable
                  onPress={() => setShowAttachmentHint(true)}
                  className="bg-muted border border-border rounded-xl p-3"
                  style={{ cursor: 'pointer' }}
                >
                  <Paperclip size={18} color="rgb(161, 161, 170)" />
                </Pressable>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('typeMessage')}
                  placeholderTextColor="rgb(148, 163, 184)"
                  onSubmitEditing={handleSend}
                  editable={!sendMessageMutation.isPending}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                  multiline
                  textAlignVertical="top"
                  style={{ outlineStyle: 'none', minHeight: 44, maxHeight: 140 } as any}
                />
                <Pressable
                  onPress={handleSend}
                  disabled={!message.trim() || sendMessageMutation.isPending}
                  className={`bg-primary p-3 rounded-xl ${
                    !message.trim() || sendMessageMutation.isPending ? 'opacity-50' : ''
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  {sendMessageMutation.isPending ? (
                    <ActivityIndicator size="small" color="#09090b" />
                  ) : (
                    <Send size={20} color="#09090b" />
                  )}
                </Pressable>
              </View>
              {showAttachmentHint && (
                <Text className="text-xs text-muted-foreground mt-2">
                  File and image uploads are coming soon.
                </Text>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
