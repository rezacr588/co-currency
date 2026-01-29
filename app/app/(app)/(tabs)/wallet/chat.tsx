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
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Markdown from 'react-native-markdown-display';
import {
  ArrowLeft,
  Bot,
  User,
  Send,
  Plus,
  Trash2,
  Sparkles,
  MessageCircle,
  X,
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
  const [showInputModal, setShowInputModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId || null
  );
  const scrollViewRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottomRef = useRef(true);
  const pendingMutationRef = useRef(false);

  // Markdown styles for AI responses
  const markdownStyles = useMemo(() => StyleSheet.create({
    body: {
      color: '#fafafa',
      fontSize: 14,
      lineHeight: 20,
    },
    heading1: {
      color: '#fafafa',
      fontSize: 20,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 8,
    },
    heading2: {
      color: '#fafafa',
      fontSize: 18,
      fontWeight: '600',
      marginTop: 10,
      marginBottom: 6,
    },
    heading3: {
      color: '#fafafa',
      fontSize: 16,
      fontWeight: '600',
      marginTop: 8,
      marginBottom: 4,
    },
    paragraph: {
      color: '#fafafa',
      fontSize: 14,
      lineHeight: 20,
      marginTop: 0,
      marginBottom: 8,
    },
    strong: {
      color: '#fafafa',
      fontWeight: '700',
    },
    em: {
      color: '#fafafa',
      fontStyle: 'italic',
    },
    link: {
      color: 'rgb(212, 175, 55)',
      textDecorationLine: 'underline',
    },
    blockquote: {
      backgroundColor: 'rgba(39, 39, 42, 0.5)',
      borderLeftColor: 'rgb(212, 175, 55)',
      borderLeftWidth: 3,
      paddingLeft: 12,
      paddingVertical: 4,
      marginVertical: 8,
    },
    code_inline: {
      backgroundColor: '#27272a',
      color: 'rgb(212, 175, 55)',
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: '#18181b',
      color: '#fafafa',
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      overflow: 'hidden',
    },
    fence: {
      backgroundColor: '#18181b',
      color: '#fafafa',
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    list_item: {
      color: '#fafafa',
      fontSize: 14,
      marginBottom: 4,
    },
    bullet_list: {
      marginVertical: 4,
    },
    ordered_list: {
      marginVertical: 4,
    },
    bullet_list_icon: {
      color: 'rgb(212, 175, 55)',
      fontSize: 14,
      marginRight: 8,
    },
    ordered_list_icon: {
      color: 'rgb(212, 175, 55)',
      fontSize: 14,
      marginRight: 8,
    },
    hr: {
      backgroundColor: '#27272a',
      height: 1,
      marginVertical: 12,
    },
    table: {
      borderColor: '#27272a',
      borderWidth: 1,
      marginVertical: 8,
    },
    thead: {
      backgroundColor: '#27272a',
    },
    th: {
      color: '#fafafa',
      fontWeight: '600',
      padding: 8,
      borderColor: '#27272a',
    },
    td: {
      color: '#fafafa',
      padding: 8,
      borderColor: '#27272a',
    },
    tr: {
      borderColor: '#27272a',
    },
  }), []);

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.ai.getStatus(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const aiConfigured = aiStatus?.configured !== false;

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

      return api.chat.sendMessage({
        conversation_id: realConversationId,
        message: msg,
      });
    },
    onMutate: async (msg) => {
      pendingMutationRef.current = true;
      setIsTyping(true);
      setSendError(null);
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
        setIsTyping(false);
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

      // Invalidate to get fresh data from server
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      setIsTyping(false);
      pendingMutationRef.current = false;
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
      setSendError(error instanceof Error ? error.message : 'Unable to reach the assistant. Please try again.');
      setIsTyping(false);
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
    if (!message.trim() || sendMessageMutation.isPending || pendingMutationRef.current) return;
    if (!aiConfigured) {
      setSendError('AI is not configured on the server.');
      return;
    }
    const trimmed = message.trim();
    sendMessageMutation.mutate(trimmed);
    setMessage('');
    void maybeStartAction(trimmed);
    isNearBottomRef.current = true;
    setTimeout(scrollToBottom, 50);
  };

  const handleNewConversation = () => {
    if (createConversationMutation.isPending || sendMessageMutation.isPending) return;
    if (!aiConfigured) {
      setSendError('AI is not configured on the server.');
      return;
    }
    // Just reset to show welcome screen - conversation will be created when user sends first message
    setActiveConversationId(null);
    setPendingAction(null);
    setSendError(null);
    isNearBottomRef.current = true;
  };

  const handleSelectConversation = (id: string) => {
    if (sendMessageMutation.isPending) return; // Don't switch while sending
    setIsTyping(false);
    setActiveConversationId(id);
    setPendingAction(null);
    setSendError(null);
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
            style={{
              flexDirection: 'row',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              width: '100%',
            }}
          >
            <View
              style={{
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: 12,
                maxWidth: '85%',
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: msg.role === 'user' ? '#27272a' : '#d4af37',
                }}
              >
                {msg.role === 'user' ? (
                  <User size={16} color="rgb(148, 163, 184)" />
                ) : (
                  <Bot size={16} color="#09090b" />
                )}
              </View>
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: msg.role === 'user' ? '#d4af37' : '#18181b',
                  borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                  borderBottomLeftRadius: msg.role === 'user' ? 16 : 4,
                  flexShrink: 1,
                }}
              >
                {msg.role === 'user' ? (
                  <Text style={{ color: '#09090b', fontSize: 15, lineHeight: 22 }}>
                    {msg.content}
                  </Text>
                ) : (
                  <Markdown style={markdownStyles}>
                    {msg.content}
                  </Markdown>
                )}
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
              className="flex-row items-center justify-between p-4 border-b border-border bg-card"
              style={contentWidthStyle}
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                  <Bot size={16} color="#09090b" />
                </View>
                <Text className="font-semibold text-foreground ml-3">{t('aiAdvisor')}</Text>
              </View>
              <Pressable
                onPress={handleNewConversation}
                className="bg-muted px-3 py-1.5 rounded-full"
              >
                <Text className="text-xs text-muted-foreground">{t('newChat') || 'New Chat'}</Text>
              </Pressable>
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

              <View className="flex-row items-center" style={{ gap: 12 }}>
                {/* Tap to open input modal */}
                <Pressable
                  onPress={() => setShowInputModal(true)}
                  disabled={sendMessageMutation.isPending}
                  style={{
                    flex: 1,
                    backgroundColor: '#18181b',
                    borderWidth: 1,
                    borderColor: '#3f3f46',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    minHeight: 48,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: message ? '#ffffff' : '#71717a', fontSize: 16 }} numberOfLines={1}>
                    {message || t('typeMessage')}
                  </Text>
                </Pressable>
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
            </View>

            {/* Input Modal */}
            <Modal
              visible={showInputModal}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setShowInputModal(false)}
            >
              <SafeAreaView style={{ flex: 1, backgroundColor: '#09090b' }}>
                <KeyboardAvoidingView
                  style={{ flex: 1 }}
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                  {/* Modal Header */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#27272a',
                  }}>
                    <Pressable
                      onPress={() => setShowInputModal(false)}
                      style={{ padding: 8 }}
                    >
                      <X size={24} color="#a1a1aa" />
                    </Pressable>
                    <Text style={{ color: '#fafafa', fontSize: 17, fontWeight: '600' }}>
                      {t('typeMessage')}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setShowInputModal(false);
                        if (message.trim()) {
                          handleSend();
                        }
                      }}
                      disabled={!message.trim() || sendMessageMutation.isPending}
                      style={{
                        backgroundColor: message.trim() ? '#d4af37' : '#27272a',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{
                        color: message.trim() ? '#09090b' : '#71717a',
                        fontWeight: '600',
                      }}>
                        {t('send') || 'Send'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Large Text Input */}
                  <View style={{ flex: 1, padding: 16 }}>
                    <TextInput
                      value={message}
                      onChangeText={setMessage}
                      placeholder={t('typeMessage')}
                      placeholderTextColor="#71717a"
                      multiline
                      autoFocus
                      selectionColor="rgb(212, 175, 55)"
                      cursorColor="rgb(212, 175, 55)"
                      style={{
                        flex: 1,
                        backgroundColor: '#18181b',
                        borderWidth: 1,
                        borderColor: '#3f3f46',
                        borderRadius: 12,
                        padding: 16,
                        color: '#ffffff',
                        fontSize: 18,
                        textAlignVertical: 'top',
                      }}
                    />
                  </View>

                  {/* Suggested prompts */}
                  <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#27272a' }}>
                    <Text style={{ color: '#71717a', fontSize: 12, marginBottom: 8 }}>
                      {t('suggestions') || 'Suggestions'}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {suggestedQuestions.slice(0, 3).map((q, i) => (
                          <Pressable
                            key={i}
                            onPress={() => setMessage(q)}
                            style={{
                              backgroundColor: '#27272a',
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                            }}
                          >
                            <Text style={{ color: '#fafafa', fontSize: 13 }}>{q}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </KeyboardAvoidingView>
              </SafeAreaView>
            </Modal>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
