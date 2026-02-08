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
import { useColors } from '../../../../src/context/ThemeContext';
import type { ChatMessage, Conversation, ConversationWithMessages } from '../../../../src/api/chat';
import type { SmartParseResponse } from '../../../../src/types/wallet';
import type { ConversionResult } from '../../../../src/types/currency';
import type { Goal, RecurringTransaction } from '../../../../src/types/goal';
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

// Question patterns — messages asking ABOUT finances, NOT requesting to add transactions
const QUESTION_PATTERNS = [
  /^(?:how\s+much|what|when|where|why|which|who|show|list|tell|display|give\s+me|can\s+you)/i,
  /\?$/,  // Ends with question mark
  /(?:total|average|summary|report|trend|score|health|forecast|analysis|breakdown|overview)/i,
  /(?:did\s+i|have\s+i|do\s+i|am\s+i|was\s+i|were\s+my)/i,
  /(?:last\s+\d+|past\s+\d+|this\s+month|this\s+week|this\s+year|last\s+month)/i,
];

// Comprehensive transaction intent patterns
const TRANSACTION_PATTERNS = [
  /(?:spent|paid|bought|buy|purchase|pay|cost|dropped|blew)/i,
  /(?:income|received|earned|got|made|collected|deposited)/i,
  /(?:add|log|record|track)\s+(?:\$|€|£|[\d,]+)/i,
  /(?:\$|€|£)[\d,]+\s+(?:for|on|at)/i,  // "$50 for coffee"
];

const RECURRING_PATTERNS = [
  /(?:every|each)\s+(?:day|week|month|year)/i,
  /(?:daily|weekly|monthly|yearly)\s+(?:expense|income|bill|payment)/i,
  /(?:rent|salary|subscription)\s+(?:of\s+)?(?:\$|€|£)?[\d,]+/i,
  /(?:\$|€|£)?[\d,]+\s+(?:rent|salary|subscription)/i,
];

const GOAL_PATTERNS = [
  /(?:put|add|contribute|save)\s+(?:\$|€|£)?[\d,]+\s+(?:to|toward|towards|into)\s+(?:goal|saving|fund|vacation|house|car)/i,
  /(?:save\s+for|saving\s+for|put\s+towards?)\s+\w+/i,
];

// Frequency keywords for recurring detection
const FREQUENCY_KEYWORDS = {
  daily: ['daily', 'every day', 'each day'],
  weekly: ['weekly', 'every week', 'each week'],
  monthly: ['monthly', 'every month', 'each month', 'rent', 'salary'],
  yearly: ['yearly', 'annually', 'every year', 'each year'],
};

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
  const colors = useColors();
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
  // Editable transaction state for validation workflow
  const [editMode, setEditMode] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'credit' | 'debit'>('debit');
  const [editCurrency, setEditCurrency] = useState('USD');
  const [editDescription, setEditDescription] = useState('');

  const scrollViewRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottomRef = useRef(true);
  const pendingMutationRef = useRef(false);
  const lastSentMessageRef = useRef<string>('');

  // Markdown styles for AI responses
  const markdownStyles = useMemo(() => StyleSheet.create({
    body: {
      color: colors.foreground,
      fontSize: 15,
      lineHeight: 22,
    },
    heading1: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 8,
    },
    heading2: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '600',
      marginTop: 10,
      marginBottom: 6,
    },
    heading3: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '600',
      marginTop: 8,
      marginBottom: 4,
    },
    paragraph: {
      color: colors.foreground,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 0,
      marginBottom: 8,
    },
    strong: {
      color: colors.foreground,
      fontWeight: '700',
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
      lineHeight: 22,
      marginBottom: 4,
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
      fontWeight: '600',
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
      // Restore the user's message so they can retry
      if (lastSentMessageRef.current) {
        setMessage(lastSentMessageRef.current);
      }
      setSendError(error instanceof Error ? error.message : 'Unable to reach the assistant. Please try again.');
      setIsTyping(false);
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
      setPendingAction((current) =>
        current && current.kind === 'recurring'
          ? { ...current, status: 'done', result }
          : current
      );
    },
    onError: (err) => {
      setPendingAction((current) =>
        current && current.kind === 'recurring'
          ? {
              ...current,
              status: 'error',
              error: err instanceof Error ? err.message : 'Could not create recurring transaction',
            }
          : current
      );
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
      setPendingAction((current) =>
        current && current.kind === 'goal_contribution'
          ? { ...current, status: 'done', result }
          : current
      );
    },
    onError: (err) => {
      setPendingAction((current) =>
        current && current.kind === 'goal_contribution'
          ? {
              ...current,
              status: 'error',
              error: err instanceof Error ? err.message : 'Could not contribute to goal',
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
    lastSentMessageRef.current = trimmed; // Save message for retry on error
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

  // Check if text looks like a question about finances rather than a transaction request
  const looksLikeQuestion = (text: string) =>
    QUESTION_PATTERNS.some(pattern => pattern.test(text.trim()));

  // Check if text looks like any kind of financial transaction (but not a question)
  const looksLikeTransaction = (text: string) =>
    !looksLikeQuestion(text) && TRANSACTION_PATTERNS.some(pattern => pattern.test(text));

  const looksLikeRecurring = (text: string) =>
    !looksLikeQuestion(text) && RECURRING_PATTERNS.some(pattern => pattern.test(text));

  const looksLikeGoalContribution = (text: string) =>
    !looksLikeQuestion(text) && GOAL_PATTERNS.some(pattern => pattern.test(text));

  // Detect frequency from text
  const detectFrequency = (text: string): string => {
    const lowerText = text.toLowerCase();
    for (const [freq, keywords] of Object.entries(FREQUENCY_KEYWORDS)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        return freq;
      }
    }
    return 'monthly'; // Default
  };

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

    // Check for goal contribution first (more specific)
    if (looksLikeGoalContribution(text)) {
      setPendingAction({
        kind: 'goal_contribution',
        status: 'loading',
        original: text,
      });
      try {
        const [parsed, goalsResponse] = await Promise.all([
          api.ai.smartParse({ text }),
          api.goals.list(),
        ]);
        setPendingAction({
          kind: 'goal_contribution',
          status: 'ready',
          original: text,
          parsed,
          goals: goalsResponse.goals || [],
          selectedGoalId: undefined,
        });
      } catch (error) {
        setPendingAction({
          kind: 'goal_contribution',
          status: 'error',
          original: text,
          error: error instanceof Error ? error.message : 'Could not parse goal contribution',
        });
      }
      return;
    }

    // Check for recurring transaction
    if (looksLikeRecurring(text)) {
      setPendingAction({
        kind: 'recurring',
        status: 'loading',
        original: text,
      });
      try {
        const parsed = await api.ai.smartParse({ text });
        const detectedFrequency = parsed.frequency || detectFrequency(text);
        setPendingAction({
          kind: 'recurring',
          status: 'ready',
          original: text,
          parsed,
          selectedFrequency: detectedFrequency,
        });
      } catch (error) {
        setPendingAction({
          kind: 'recurring',
          status: 'error',
          original: text,
          error: error instanceof Error ? error.message : 'Could not parse recurring transaction',
        });
      }
      return;
    }

    // Regular transaction
    if (looksLikeTransaction(text)) {
      setPendingAction({
        kind: 'transaction',
        status: 'loading',
        original: text,
      });
      try {
        const parsed = await api.ai.smartParse({ text });
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
          <Plus size={20} color={colors.primaryForeground} />
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
                  ? colors.accent
                  : colors.placeholder
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
              <Trash2 size={16} color={colors.danger} />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderWelcome = () => (
    <View className="flex-1 items-center justify-center p-6">
      <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-4">
        <Sparkles size={32} color={colors.primaryForeground} />
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
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        );
      }
      if (!aiConfigured) {
        return (
          <View className="bg-card border border-border rounded-2xl p-6 items-center">
            <Sparkles size={24} color={colors.accent} />
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
            <View className="bg-card px-4 py-3 rounded-2xl rounded-bl-sm" style={{ maxWidth: '90%' }}>
              <View className="flex-row" style={{ gap: 4 }}>
                <View className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                <View className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                <View className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
              </View>
            </View>
          </View>
        )}

        {pendingAction && (
          <View className="flex-row justify-start" style={{ width: '100%' }}>
            <View className="bg-card border border-border rounded-2xl px-4 py-3" style={{ maxWidth: '90%' }}>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-semibold text-foreground">
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
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text className="text-sm text-muted-foreground ml-2">
                      {pendingAction.kind === 'transaction' || pendingAction.kind === 'recurring' || pendingAction.kind === 'goal_contribution'
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
                    {!editMode ? (
                      <>
                        {/* Preview Mode */}
                        <View className="bg-muted border border-border rounded-xl p-3 mb-3">
                          <View className="flex-row items-center justify-between mb-2">
                            <View className={`px-2 py-1 rounded ${pendingAction.parsed.type === 'credit' ? 'bg-success/20' : 'bg-danger/20'}`}>
                              <Text className={`text-xs font-semibold ${pendingAction.parsed.type === 'credit' ? 'text-success' : 'text-danger'}`}>
                                {pendingAction.parsed.type === 'credit' ? 'Income' : 'Expense'}
                              </Text>
                            </View>
                            <Text className="text-sm font-bold text-foreground">
                              {pendingAction.parsed.currency} {pendingAction.parsed.amount.toFixed(2)}
                            </Text>
                          </View>
                          <Text className="text-xs text-muted-foreground mb-1">
                            {pendingAction.parsed.description}
                          </Text>
                          {pendingAction.parsed.category && pendingAction.parsed.category !== 'other' && (
                            <Text className="text-xs text-accent">
                              Category: {pendingAction.parsed.category}
                            </Text>
                          )}
                          {pendingAction.parsed.confidence < 0.8 && (
                            <View className="mt-2 bg-warning/10 p-2 rounded">
                              <Text className="text-xs text-warning">
                                Low confidence ({(pendingAction.parsed.confidence * 100).toFixed(0)}%) - Please verify details
                              </Text>
                            </View>
                          )}
                        </View>
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                          <Pressable
                            onPress={() => applyParsedMutation.mutate(pendingAction.parsed!)}
                            disabled={applyParsedMutation.isPending}
                            className={`bg-primary px-4 py-2 rounded-lg ${applyParsedMutation.isPending ? 'opacity-50' : ''}`}
                            style={{ cursor: 'pointer' }}
                          >
                            <Text className="text-primary-foreground text-sm font-semibold">
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
                            className="bg-secondary px-4 py-2 rounded-lg border border-border"
                            style={{ cursor: 'pointer' }}
                          >
                            <Text className="text-foreground text-sm font-semibold">Edit</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setPendingAction(null)}
                            className="px-4 py-2"
                            style={{ cursor: 'pointer' }}
                          >
                            <Text className="text-muted-foreground text-sm">Dismiss</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        {/* Edit Mode */}
                        <View className="mb-3">
                          <Text className="text-xs text-muted-foreground mb-2">Type</Text>
                          <View className="flex-row" style={{ gap: 8 }}>
                            <Pressable
                              onPress={() => setEditType('debit')}
                              className={`flex-1 p-2 rounded-lg border ${editType === 'debit' ? 'bg-danger/20 border-danger' : 'bg-muted border-border'}`}
                              style={{ cursor: 'pointer' }}
                            >
                              <Text className={`text-xs text-center font-semibold ${editType === 'debit' ? 'text-danger' : 'text-muted-foreground'}`}>
                                Expense
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setEditType('credit')}
                              className={`flex-1 p-2 rounded-lg border ${editType === 'credit' ? 'bg-success/20 border-success' : 'bg-muted border-border'}`}
                              style={{ cursor: 'pointer' }}
                            >
                              <Text className={`text-xs text-center font-semibold ${editType === 'credit' ? 'text-success' : 'text-muted-foreground'}`}>
                                Income
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        <View className="flex-row mb-3" style={{ gap: 8 }}>
                          <View style={{ flex: 2 }}>
                            <Text className="text-xs text-muted-foreground mb-1">Amount</Text>
                            <TextInput
                              value={editAmount}
                              onChangeText={setEditAmount}
                              keyboardType="decimal-pad"
                              className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                              style={{ outlineStyle: 'none' } as any}
                              placeholderTextColor={colors.mutedForeground}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text className="text-xs text-muted-foreground mb-1">Currency</Text>
                            <TextInput
                              value={editCurrency}
                              onChangeText={(text) => setEditCurrency(text.toUpperCase())}
                              maxLength={3}
                              className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                              style={{ outlineStyle: 'none' } as any}
                              placeholderTextColor={colors.mutedForeground}
                            />
                          </View>
                        </View>
                        <View className="mb-3">
                          <Text className="text-xs text-muted-foreground mb-1">Description</Text>
                          <TextInput
                            value={editDescription}
                            onChangeText={setEditDescription}
                            className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                            style={{ outlineStyle: 'none' } as any}
                            placeholderTextColor={colors.mutedForeground}
                          />
                        </View>
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
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
                            className={`bg-primary px-4 py-2 rounded-lg ${applyParsedMutation.isPending ? 'opacity-50' : ''}`}
                            style={{ cursor: 'pointer' }}
                          >
                            <Text className="text-primary-foreground text-sm font-semibold">
                              {applyParsedMutation.isPending ? 'Adding...' : 'Confirm & Add'}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setEditMode(false)}
                            className="bg-secondary px-4 py-2 rounded-lg border border-border"
                            style={{ cursor: 'pointer' }}
                          >
                            <Text className="text-foreground text-sm font-semibold">Cancel</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </>
                )}

                {/* Recurring Transaction Card */}
                {pendingAction.kind === 'recurring' && pendingAction.status === 'ready' && pendingAction.parsed && (
                  <>
                    <View className="bg-muted border border-border rounded-xl p-3 mb-3">
                      <View className="flex-row items-center justify-between mb-2">
                        <View className={`px-2 py-1 rounded ${pendingAction.parsed.type === 'credit' ? 'bg-success/20' : 'bg-danger/20'}`}>
                          <Text className={`text-xs font-semibold ${pendingAction.parsed.type === 'credit' ? 'text-success' : 'text-danger'}`}>
                            {pendingAction.parsed.type === 'credit' ? 'Recurring Income' : 'Recurring Expense'}
                          </Text>
                        </View>
                        <Text className="text-sm font-bold text-foreground">
                          {pendingAction.parsed.currency} {pendingAction.parsed.amount.toFixed(2)}
                        </Text>
                      </View>
                      <Text className="text-xs text-muted-foreground mb-2">
                        {pendingAction.parsed.description}
                      </Text>
                      {pendingAction.parsed.category && pendingAction.parsed.category !== 'other' && (
                        <Text className="text-xs text-accent">
                          Category: {pendingAction.parsed.category}
                        </Text>
                      )}
                    </View>
                    {/* Frequency selector */}
                    <View className="mb-3">
                      <Text className="text-xs text-muted-foreground mb-2">Frequency</Text>
                      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {['daily', 'weekly', 'monthly', 'yearly'].map((freq) => (
                          <Pressable
                            key={freq}
                            onPress={() => setPendingAction(prev =>
                              prev?.kind === 'recurring' ? { ...prev, selectedFrequency: freq } : prev
                            )}
                            className={`px-3 py-2 rounded-lg border ${
                              pendingAction.selectedFrequency === freq
                                ? 'bg-primary/20 border-primary'
                                : 'bg-muted border-border'
                            }`}
                            style={{ cursor: 'pointer' }}
                          >
                            <Text className={`text-xs font-medium capitalize ${
                              pendingAction.selectedFrequency === freq ? 'text-accent' : 'text-foreground'
                            }`}>
                              {freq}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                      <Pressable
                        onPress={() => applyRecurringMutation.mutate({
                          parsed: pendingAction.parsed!,
                          frequency: pendingAction.selectedFrequency || 'monthly',
                        })}
                        disabled={applyRecurringMutation.isPending}
                        className={`bg-primary px-4 py-2 rounded-lg ${applyRecurringMutation.isPending ? 'opacity-50' : ''}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <Text className="text-primary-foreground text-sm font-semibold">
                          {applyRecurringMutation.isPending ? 'Creating...' : 'Create recurring'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingAction(null)}
                        className="px-4 py-2"
                        style={{ cursor: 'pointer' }}
                      >
                        <Text className="text-muted-foreground text-sm">Dismiss</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {/* Goal Contribution Card */}
                {pendingAction.kind === 'goal_contribution' && pendingAction.status === 'ready' && pendingAction.parsed && (
                  <>
                    <View className="bg-muted border border-border rounded-xl p-3 mb-3">
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="px-2 py-1 rounded bg-accent/20">
                          <Text className="text-xs font-semibold text-accent">Goal Contribution</Text>
                        </View>
                        <Text className="text-sm font-bold text-foreground">
                          {pendingAction.parsed.currency} {pendingAction.parsed.amount.toFixed(2)}
                        </Text>
                      </View>
                      {pendingAction.parsed.goal_name && (
                        <Text className="text-xs text-muted-foreground">
                          Detected goal: {pendingAction.parsed.goal_name}
                        </Text>
                      )}
                    </View>
                    {/* Goal selector */}
                    {pendingAction.goals && pendingAction.goals.length > 0 ? (
                      <View className="mb-3">
                        <Text className="text-xs text-muted-foreground mb-2">Select goal to contribute to</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View className="flex-row" style={{ gap: 8 }}>
                            {pendingAction.goals.map((goal) => (
                              <Pressable
                                key={goal.id}
                                onPress={() => setPendingAction(prev =>
                                  prev?.kind === 'goal_contribution' ? { ...prev, selectedGoalId: goal.id } : prev
                                )}
                                className={`px-3 py-2 rounded-lg border ${
                                  pendingAction.selectedGoalId === goal.id
                                    ? 'bg-primary/20 border-primary'
                                    : 'bg-muted border-border'
                                }`}
                                style={{ cursor: 'pointer' }}
                              >
                                <Text className={`text-xs font-medium ${
                                  pendingAction.selectedGoalId === goal.id ? 'text-accent' : 'text-foreground'
                                }`}>
                                  {goal.name}
                                </Text>
                                <Text className="text-xs text-muted-foreground">
                                  {goal.currency} {goal.current_amount.toFixed(0)} / {goal.target_amount.toFixed(0)}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    ) : (
                      <View className="mb-3 bg-warning/10 p-2 rounded">
                        <Text className="text-xs text-warning">
                          No goals found. Create a goal first to contribute.
                        </Text>
                      </View>
                    )}
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
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
                        className={`bg-primary px-4 py-2 rounded-lg ${
                          applyGoalContributionMutation.isPending || !pendingAction.selectedGoalId ? 'opacity-50' : ''
                        }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <Text className="text-primary-foreground text-sm font-semibold">
                          {applyGoalContributionMutation.isPending ? 'Contributing...' : 'Contribute'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingAction(null)}
                        className="px-4 py-2"
                        style={{ cursor: 'pointer' }}
                      >
                        <Text className="text-muted-foreground text-sm">Dismiss</Text>
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
                      : pendingAction.kind === 'recurring'
                        ? 'Recurring transaction created.'
                        : pendingAction.kind === 'goal_contribution'
                          ? 'Contribution added to goal.'
                          : pendingAction.kind === 'convert'
                            ? 'Conversion completed.'
                            : 'Rate updated.'}
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
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: msg.role === 'user' ? colors.accent : colors.muted,
                borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                borderBottomLeftRadius: msg.role === 'user' ? 16 : 4,
                maxWidth: '90%',
              }}
            >
              {msg.role === 'user' ? (
                <Text style={{ color: colors.primaryForeground, fontSize: 16, lineHeight: 24 }}>
                  {msg.content}
                </Text>
              ) : (
                <Markdown style={markdownStyles}>
                  {msg.content}
                </Markdown>
              )}
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
                  <Bot size={16} color={colors.primaryForeground} />
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
                    <Plus size={16} color={colors.primaryForeground} />
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
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
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
                    backgroundColor: colors.muted,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    minHeight: 48,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: message ? colors.foreground : colors.mutedForeground, fontSize: 16 }} numberOfLines={1}>
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
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Send size={20} color={colors.primaryForeground} />
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
              <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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
                    borderBottomColor: colors.secondary,
                  }}>
                    <Pressable
                      onPress={() => setShowInputModal(false)}
                      style={{ padding: 8 }}
                    >
                      <X size={24} color={colors.secondaryForeground} />
                    </Pressable>
                    <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '600' }}>
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
                        backgroundColor: message.trim() ? colors.accent : colors.secondary,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{
                        color: message.trim() ? colors.primaryForeground : colors.mutedForeground,
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
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      autoFocus
                      selectionColor={colors.accent}
                      cursorColor={colors.accent}
                      style={{
                        flex: 1,
                        backgroundColor: colors.muted,
                        borderWidth: 1,
                        borderColor: colors.borderStrong,
                        borderRadius: 12,
                        padding: 16,
                        color: colors.foreground,
                        fontSize: 18,
                        textAlignVertical: 'top',
                      }}
                    />
                  </View>

                  {/* Suggested prompts */}
                  <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.secondary }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>
                      {t('suggestions') || 'Suggestions'}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {suggestedQuestions.slice(0, 3).map((q, i) => (
                          <Pressable
                            key={i}
                            onPress={() => setMessage(q)}
                            style={{
                              backgroundColor: colors.secondary,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                            }}
                          >
                            <Text style={{ color: colors.foreground, fontSize: 13 }}>{q}</Text>
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
