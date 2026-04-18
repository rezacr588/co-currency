import { memo, useState, useRef, useEffect, useCallback, useMemo, type ComponentProps } from 'react';
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
  Clipboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  Cpu,
  Coins,
  Activity,
  Table2,
} from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { useToast } from '../../../../src/components/ui/Toast';
import { haptics } from '../../../../src/utils/haptics';
import {
  AttachmentButton,
  AttachmentPreview,
  useAttachmentPicker,
  ChatHeader,
  ConversationSidebar,
  ChatInputComposer,
  ChatActivityModal,
  ChatUsageModal,
  ChatPendingActionFlow,
  type PendingAction,
} from '../../../../src/components/features/Chat';
import { VoiceRecorder } from '../../../../src/components/features/Chat';
import { RecommendedActionCards } from '../../../../src/components/features/CoAI/RecommendedActionCards';
import { EmptyState } from '../../../../src/components/ui';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import { useChatKeyboardShortcuts } from '../../../../src/hooks/useKeyboardShortcuts';
import type { ChatMessage, ChatStreamTraceEvent, Conversation, ConversationWithMessages } from '../../../../src/api/chat';
import type { SmartParseResponse } from '../../../../src/types/wallet';
import type { ConversionResult } from '../../../../src/types/currency';
import type { Goal, RecurringTransaction } from '../../../../src/types/goal';
import { openRecommendedAction } from '../../../../src/utils/coaiActions';
import { formatNumber } from '../../../../src/utils/format';
import { STALE_REALTIME, STALE_FREQUENT, STALE_STANDARD } from '../../../../src/config/queryConfig';

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

function extractFirstMarkdownTable(content: string): { body: string; table: string | null } {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const divider = lines[i + 1];
    const looksLikeHeader = line.includes('|');
    const looksLikeDivider = /^\s*\|?[\s:-]+\|[\s|:-]*\s*$/.test(divider);
    if (!looksLikeHeader || !looksLikeDivider) continue;

    let end = i + 2;
    while (end < lines.length && lines[end].includes('|')) {
      end += 1;
    }
    const tableLines = lines.slice(i, end);
    if (tableLines.length < 3) continue;

    const table = tableLines.join('\n').trim();
    const body = [...lines.slice(0, i), ...lines.slice(end)].join('\n').trim();
    return { body, table };
  }

  return { body: normalized.trim(), table: null };
}

function formatUsd(value: number | undefined): string {
  if (!value || Number.isNaN(value)) return '$0.0000';
  return `$${value.toFixed(4)}`;
}

type ToolUsageItem = {
  name: string;
  count: number;
};

type MarkdownStyles = NonNullable<ComponentProps<typeof Markdown>['style']>;
type ChatRecommendedAction = NonNullable<ChatMessage['recommended_actions']>[number];
type TranslationFn = (key: string) => string | undefined;
type ToastFn = ReturnType<typeof useToast>['showToast'];
type ChatColors = {
  primary: string;
  card: string;
  border: string;
  primaryForeground: string;
  foreground: string;
  accent: string;
  muted: string;
  mutedForeground: string;
  secondary: string;
};

const EMPTY_TRACE_EVENTS: ChatStreamTraceEvent[] = [];

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  search_transactions: 'Transactions API',
  get_monthly_report: 'Monthly Report API',
  get_category_report: 'Category Report API',
  get_spending_trends: 'Spending Trends API',
  get_financial_forecast: 'Forecast API',
  get_health_score: 'Health Score API',
  get_subscriptions: 'Subscriptions API',
  search_notes: 'Notes Search API',
  web_search: 'Web Search API',
};

function getToolDisplayName(toolName: string): string {
  if (!toolName) return 'Tool';
  if (TOOL_DISPLAY_NAMES[toolName]) {
    return TOOL_DISPLAY_NAMES[toolName];
  }
  return toolName
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function aggregateToolUsageFromTrace(events: ChatStreamTraceEvent[] | undefined): ToolUsageItem[] {
  if (!events || events.length === 0) return [];
  const usage = new Map<string, number>();
  let sawExecutionStage = false;

  events.forEach((event) => {
    if (!event || typeof event.tool_name !== 'string' || !event.tool_name) return;
    const stage = typeof event.stage === 'string' ? event.stage : '';
    if (stage === 'tool_execution_completed' || stage === 'tool_execution_failed') {
      sawExecutionStage = true;
      usage.set(event.tool_name, (usage.get(event.tool_name) || 0) + 1);
    }
  });

  if (!sawExecutionStage) {
    events.forEach((event) => {
      if (!event || typeof event.tool_name !== 'string' || !event.tool_name) return;
      const stage = typeof event.stage === 'string' ? event.stage : '';
      if (stage !== 'tool_call_detected') {
        return;
      }
      usage.set(event.tool_name, (usage.get(event.tool_name) || 0) + 1);
    });
  }

  return Array.from(usage.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function getMessageToolUsage(message: ChatMessage | undefined, traceEvents: ChatStreamTraceEvent[] | undefined): ToolUsageItem[] {
  if (message?.tools_used && message.tools_used.length > 0) {
    return message.tools_used
      .filter((tool) => Boolean(tool?.name))
      .map((tool) => ({ name: tool.name, count: Math.max(1, Number(tool.count) || 1) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }
  return aggregateToolUsageFromTrace(traceEvents);
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

interface ChatMessageBubbleProps {
  colors: ChatColors;
  groupedWithNext: boolean;
  groupedWithPrev: boolean;
  index: number;
  markdownStyles: MarkdownStyles;
  message: ChatMessage;
  messageMaxWidth: number;
  messageTrace: ChatStreamTraceEvent[];
  onOpenActivity: (messageId: string) => void;
  onOpenRecommendedAction: (action: ChatRecommendedAction) => void;
  onOpenTable: (markdown: string) => void;
  showToast: ToastFn;
  t: TranslationFn;
}

const ChatMessageBubble = memo(function ChatMessageBubble({
  colors,
  groupedWithNext,
  groupedWithPrev,
  index,
  markdownStyles,
  message,
  messageMaxWidth,
  messageTrace,
  onOpenActivity,
  onOpenRecommendedAction,
  onOpenTable,
  showToast,
  t,
}: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';
  const isTempId = message.id.startsWith('temp-');
  const baseRadius = 18;
  const chainRadius = 12;
  const tailRadius = 6;
  const a11yPrefix = isUser ? t('yourMessage') || 'Your message' : t('aiResponse') || 'AI response';
  const a11yContent =
    message.content.length > 200 ? `${message.content.slice(0, 200)}...` : message.content;
  const { body, table } = useMemo(
    () => (isUser ? { body: message.content, table: null } : extractFirstMarkdownTable(message.content)),
    [isUser, message.content]
  );
  const messageToolUsage = useMemo(
    () => getMessageToolUsage(message, messageTrace),
    [message, messageTrace]
  );
  const activityLabel = useMemo(() => {
    if (messageToolUsage.length > 0) {
      return `${messageToolUsage.length} tool${messageToolUsage.length === 1 ? '' : 's'}`;
    }
    if (messageTrace.length > 0) {
      return `${messageTrace.length} step${messageTrace.length === 1 ? '' : 's'}`;
    }
    return '';
  }, [messageToolUsage, messageTrace.length]);
  const tokenCount = message.total_tokens || message.tokens_used;
  const hasUsageMeta = Boolean(
    message.provider ||
      message.model ||
      message.thinking_mode ||
      tokenCount ||
      message.estimated_cost_usd ||
      message.billed_cost_usd
  );

  const handleCopyMessage = useCallback(() => {
    Clipboard.setString(message.content);
    haptics.light();
    showToast(t('copied') || 'Copied!', 'success');
  }, [message.content, showToast, t]);

  return (
    <View
      accessible
      accessibilityLabel={`${a11yPrefix}: ${a11yContent}`}
      style={{
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
        marginTop: index === 0 ? 0 : groupedWithPrev ? 4 : 12,
      }}
    >
      <Pressable
        onLongPress={!isUser ? handleCopyMessage : undefined}
        style={{
          paddingHorizontal: 13,
          paddingVertical: 9,
          borderRadius: baseRadius,
          backgroundColor: isUser ? colors.primary : colors.card,
          borderWidth: isUser ? 0 : 1,
          borderColor: isUser ? 'transparent' : colors.border,
          borderTopLeftRadius: groupedWithPrev ? chainRadius : baseRadius,
          borderTopRightRadius: groupedWithPrev ? chainRadius : baseRadius,
          borderBottomRightRadius: isUser
            ? groupedWithNext
              ? chainRadius
              : tailRadius
            : groupedWithNext
              ? chainRadius
              : baseRadius,
          borderBottomLeftRadius: isUser
            ? groupedWithNext
              ? chainRadius
              : baseRadius
            : groupedWithNext
              ? chainRadius
              : tailRadius,
          maxWidth: isUser
            ? Math.min(messageMaxWidth, 500)
            : Math.min(messageMaxWidth + 28, 560),
        }}
      >
        {isUser ? (
          <Text style={{ color: colors.primaryForeground, fontSize: 15, lineHeight: 21 }}>
            {message.content}
          </Text>
        ) : (
          <View>
            {body ? <Markdown style={markdownStyles}>{body}</Markdown> : null}

            {table ? (
              <Pressable
                onPress={() => onOpenTable(table)}
                accessibilityRole="button"
                accessibilityLabel="Open AI response table"
                style={({ pressed }) => [
                  {
                    marginTop: 6,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.muted,
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Table2 size={13} color={colors.accent} />
                <Text
                  style={{
                    color: colors.foreground,
                    marginStart: 6,
                    fontSize: 12,
                    fontFamily: 'Inter_500Medium',
                  }}
                >
                  Open Table
                </Text>
              </Pressable>
            ) : null}

            {messageToolUsage.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, marginBottom: 5 }}>
                  Tools used
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {messageToolUsage.map((tool) => (
                    <View
                      key={`${message.id}-${tool.name}`}
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 4,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondary,
                      }}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 10 }}>
                        {getToolDisplayName(tool.name)}
                        {tool.count > 1 ? ` ×${tool.count}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {message.recommended_actions && message.recommended_actions.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <RecommendedActionCards
                  actions={message.recommended_actions}
                  onActionPress={onOpenRecommendedAction}
                  compact
                />
              </View>
            ) : null}

            {hasUsageMeta ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {message.provider || message.model ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 7,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: colors.secondary,
                    }}
                  >
                    <Cpu size={11} color={colors.mutedForeground} />
                    <Text
                      style={{ color: colors.mutedForeground, fontSize: 10, marginStart: 4 }}
                      numberOfLines={1}
                    >
                      {[message.provider, message.model].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ) : null}
                {message.thinking_mode ? (
                  <View
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: colors.secondary,
                    }}
                  >
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                      {message.thinking_mode}
                    </Text>
                  </View>
                ) : null}
                {tokenCount ? (
                  <View
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: colors.secondary,
                    }}
                  >
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{tokenCount} tok</Text>
                  </View>
                ) : null}
                {message.estimated_cost_usd || message.billed_cost_usd ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 7,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: colors.secondary,
                    }}
                  >
                    <Coins size={11} color={colors.mutedForeground} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 10, marginStart: 4 }}>
                      {formatUsd(message.billed_cost_usd ?? message.estimated_cost_usd)}{' '}
                      {message.billing_source ? `(${message.billing_source})` : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Pressable
              onPress={() => onOpenActivity(message.id)}
              style={({ pressed }) => [
                {
                  marginTop: 8,
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Activity size={11} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 10, marginStart: 4 }}>
                Agent Activity {activityLabel ? `(${activityLabel})` : ''}
              </Text>
            </Pressable>
          </View>
        )}
      </Pressable>
      {!groupedWithNext && !isTempId ? (
        <Text
          style={{
            fontSize: 10,
            color: colors.mutedForeground,
            marginTop: 2,
            alignSelf: isUser ? 'flex-end' : 'flex-start',
            marginHorizontal: 4,
          }}
        >
          {formatMessageTime(message.created_at)}
        </Text>
      ) : null}
    </View>
  );
});

export default function AIChatScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { alpha } = theme;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);
  const { conversationId, prompt } = useLocalSearchParams<{ conversationId?: string; prompt?: string }>();
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
  const [thinkingMode, setThinkingMode] = useState<'auto' | 'fast' | 'thinking'>('auto');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingDraft, setStreamingDraft] = useState('');
  const [streamInterrupted, setStreamInterrupted] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId || null
  );
  // Edit mode state moved to ChatPendingActionFlow component
  const [liveTrace, setLiveTrace] = useState<ChatStreamTraceEvent[]>([]);
  const [traceByMessageID, setTraceByMessageID] = useState<Record<string, ChatStreamTraceEvent[]>>({});
  const [isActivityModalVisible, setIsActivityModalVisible] = useState(false);
  const [selectedActivityMessageID, setSelectedActivityMessageID] = useState<string | null>(null);
  const [isUsageModalVisible, setIsUsageModalVisible] = useState(false);
  const [usageWindowDays, setUsageWindowDays] = useState<7 | 30>(7);
  const [tableModalContent, setTableModalContent] = useState<{ title: string; markdown: string } | null>(null);

  const { attachment, isRecordingVoice, showPicker: showAttachmentPicker, clearAttachment, handleVoiceComplete, cancelVoice } = useAttachmentPicker();

  const scrollViewRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottomRef = useRef(true);
  const pendingMutationRef = useRef(false);
  const lastSentMessageRef = useRef<string>('');
  const consumedPromptRef = useRef<string | null>(null);
  const liveTraceRef = useRef<ChatStreamTraceEvent[]>([]);
  const streamingDraftRef = useRef('');
  const streamReplayTokenRef = useRef(0);
  const cancelReplayStream = useCallback(() => {
    streamReplayTokenRef.current += 1;
  }, []);
  const clearStreamingState = useCallback(() => {
    cancelReplayStream();
    setIsTyping(false);
    setStreamingDraft('');
    streamingDraftRef.current = '';
    setStreamInterrupted(false);
  }, [cancelReplayStream]);
  const clearConversationTransientState = useCallback(() => {
    setPendingAction(null);
    setSendError(null);
    setStreamingDraft('');
    liveTraceRef.current = [];
    setLiveTrace([]);
    setSelectedActivityMessageID(null);
  }, []);
  const replayMessageAsStream = useCallback(async (content: string) => {
    if (!content) return;
    const replayToken = streamReplayTokenRef.current + 1;
    streamReplayTokenRef.current = replayToken;
    const chunkSize = 28;
    const frameMs = 14;
    setIsTyping(false);
    setStreamingDraft('');
    for (let i = 0; i < content.length; i += chunkSize) {
      if (streamReplayTokenRef.current !== replayToken) return;
      const nextChunk = content.slice(i, i + chunkSize);
      setStreamingDraft((prev) => prev + nextChunk);
      await new Promise((resolve) => setTimeout(resolve, frameMs));
    }
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
      paddingStart: 12,
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
      marginEnd: 8,
    },
    ordered_list_icon: {
      color: colors.accent,
      fontSize: 14,
      marginEnd: 8,
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
    staleTime: STALE_STANDARD,
  });

  const aiConfigured = aiStatus?.configured !== false;
  const aiRateLimitPerMinute = aiStatus?.rate_limit_per_minute ?? 20;
  const aiRateLimitBurst = aiStatus?.rate_limit_burst ?? 5;

  const { data: usageSummary, isLoading: isUsageSummaryLoading } = useQuery({
    queryKey: ['ai-usage-summary', usageWindowDays],
    queryFn: () => api.chat.getUsageSummary(usageWindowDays),
    enabled: isUsageModalVisible && aiConfigured,
    staleTime: STALE_FREQUENT,
  });

  // Fetch conversations list
  const { data: conversationsData } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api.chat.listConversations(),
    enabled: aiConfigured,
    staleTime: STALE_REALTIME,
  });

  // Fetch current conversation messages
  const { data: currentConversation, isLoading: loadingMessages } = useQuery({
    queryKey: ['ai-conversation', activeConversationId],
    queryFn: () =>
      activeConversationId ? api.chat.getConversation(activeConversationId) : null,
    enabled: !!activeConversationId && aiConfigured,
    staleTime: STALE_REALTIME,
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
          thinking_mode: thinkingMode,
          file: attachment,
        });
        return result;
      }

      try {
        let deltaEvents = 0;
        const streamCallbacks: Parameters<typeof api.chat.sendMessageStream>[1] = {
          onStart: (event) => {
            liveTraceRef.current = [];
            setLiveTrace([]);
            if (__DEV__ && event.trace_id) {
              console.debug(`[AI trace] stream start: ${event.trace_id}`);
            }
          },
          onDelta: (event) => {
            if (!mountedRef.current) return;
            deltaEvents += 1;
            setIsTyping(false);
            streamingDraftRef.current += event.content;
            setStreamingDraft((prev) => prev + event.content);
          },
          onTrace: (event: ChatStreamTraceEvent) => {
            if (!mountedRef.current) return;
            liveTraceRef.current = [...liveTraceRef.current, event];
            setLiveTrace(liveTraceRef.current);
            if (__DEV__) {
              console.debug('[AI trace]', event);
            }
          },
          onDone: (event) => {
            if (!mountedRef.current) return;
            if (__DEV__ && event.trace_id) {
              console.debug(`[AI trace] stream done: ${event.trace_id}`);
            }
            if (event.message?.id) {
              const completedTrace = [...liveTraceRef.current];
              setTraceByMessageID((prev) => ({ ...prev, [event.message.id]: completedTrace }));
            }
            liveTraceRef.current = [];
            setLiveTrace([]);
          },
        };

        const result = await api.chat.sendMessageStream(
          {
            conversation_id: realConversationId,
            message: msg,
            thinking_mode: thinkingMode,
          },
          streamCallbacks
        );
        if (deltaEvents <= 1 && result?.message?.content) {
          await replayMessageAsStream(result.message.content);
        }
        return result;
      } catch (streamErr) {
        if (streamingDraftRef.current) {
          setStreamInterrupted(true);
        } else {
          setStreamingDraft('');
        }
        throw streamErr;
      }
    },
    onMutate: async (msg) => {
      pendingMutationRef.current = true;
      cancelReplayStream();
      setIsTyping(true);
      setStreamingDraft('');
      liveTraceRef.current = [];
      setLiveTrace([]);
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

      if (liveTraceRef.current.length > 0 && data.message?.id) {
        const finalTrace = [...liveTraceRef.current];
        setTraceByMessageID((prev) => ({ ...prev, [data.message.id]: finalTrace }));
        liveTraceRef.current = [];
        setLiveTrace([]);
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
      haptics.success();
      pendingMutationRef.current = false;
      lastSentMessageRef.current = ''; // Clear saved message on success
    },
    onError: (error, _msg, context) => {
      liveTraceRef.current = [];
      setLiveTrace([]);
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
      haptics.error();
      if (!streamInterrupted) {
        clearStreamingState();
      }
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
      showToast(t('conversationDeleted') || 'Conversation deleted', 'info');
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
  const messageByID = useMemo(() => {
    const index: Record<string, ChatMessage> = {};
    messages.forEach((msg) => {
      index[msg.id] = msg;
    });
    return index;
  }, [messages]);
  const latestAssistantMessageID = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);
  const effectiveActivityMessageID = selectedActivityMessageID || (liveTrace.length === 0 ? latestAssistantMessageID : null);
  const activeTraceEvents = effectiveActivityMessageID
    ? traceByMessageID[effectiveActivityMessageID] || []
    : liveTrace;
  const activeActivityMessage = effectiveActivityMessageID ? messageByID[effectiveActivityMessageID] : undefined;
  const activeToolUsage = getMessageToolUsage(activeActivityMessage, activeTraceEvents);
  const hasTypedMessage = message.trim().length > 0;
  const canSendMessage =
    (hasTypedMessage || !!attachment) &&
    message.length <= MAX_MESSAGE_LENGTH &&
    !sendMessageMutation.isPending;
  const inputPlaceholder = attachment
    ? (t('addCaption') || 'Add optional caption...')
    : (t('typeMessage') || 'Type a message');
  const quickPrompts = useMemo(
    () =>
      [
        t('suggestedQuestion1'),
        t('suggestedQuestion2'),
        t('suggestedQuestion3'),
        t('suggestedAction1'),
      ].filter((item): item is string => Boolean(item)),
    [t]
  );
  const handleOpenTable = useCallback((markdown: string) => {
    setTableModalContent({ title: 'AI Table', markdown });
  }, []);
  const handleOpenActivity = useCallback((messageId: string) => {
    setSelectedActivityMessageID(messageId);
    setIsActivityModalVisible(true);
  }, []);
  const handleOpenRecommendedAction = useCallback(
    (action: ChatRecommendedAction) => {
      openRecommendedAction(router, action);
    },
    [router]
  );

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

  const renderMessageItem = useCallback(
    ({ item: msg, index }: { item: ChatMessage; index: number }) => {
      const previousMessage = index > 0 ? messages[index - 1] : null;
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;

      return (
        <ChatMessageBubble
          colors={colors}
          groupedWithNext={nextMessage?.role === msg.role}
          groupedWithPrev={previousMessage?.role === msg.role}
          index={index}
          markdownStyles={markdownStyles}
          message={msg}
          messageMaxWidth={messageMaxWidth}
          messageTrace={traceByMessageID[msg.id] || EMPTY_TRACE_EVENTS}
          onOpenActivity={handleOpenActivity}
          onOpenRecommendedAction={handleOpenRecommendedAction}
          onOpenTable={handleOpenTable}
          showToast={showToast}
          t={t}
        />
      );
    },
    [
      colors,
      handleOpenActivity,
      handleOpenRecommendedAction,
      handleOpenTable,
      markdownStyles,
      messageMaxWidth,
      messages,
      showToast,
      t,
      traceByMessageID,
    ]
  );

  useEffect(() => {
    if (!conversationId || conversationId === activeConversationId) {
      return;
    }

    clearStreamingState();
    setActiveConversationId(conversationId);
    clearConversationTransientState();
    isNearBottomRef.current = true;
  }, [
    activeConversationId,
    clearConversationTransientState,
    clearStreamingState,
    conversationId,
  ]);

  useEffect(() => {
    if (typeof prompt !== 'string') {
      return;
    }

    const trimmed = prompt.trim();
    if (!trimmed || consumedPromptRef.current === trimmed) {
      return;
    }

    consumedPromptRef.current = trimmed;
    if (!message && !activeConversationId) {
      setMessage(trimmed);
    }
  }, [activeConversationId, message, prompt]);


  const handleSend = (overrideMessage?: string) => {
    const msgToSend = overrideMessage || message;
    const trimmed = msgToSend.trim();
    const effectiveMessage = trimmed || (attachment ? (t('analyzeAttachment') || 'Analyze this file') : '');
    if (!effectiveMessage || sendMessageMutation.isPending || pendingMutationRef.current) return;
    if (msgToSend.length > MAX_MESSAGE_LENGTH) return;
    if (!aiConfigured) {
      setSendError('AI is not configured on the server.');
      return;
    }
    haptics.light();
    lastSentMessageRef.current = effectiveMessage; // Save message for retry on error
    sendMessageMutation.mutate(effectiveMessage);
    clearAttachment();
    if (!overrideMessage) setMessage('');
    setLastFailedMessage(null);
    setStreamInterrupted(false);
    if (effectiveMessage) {
      void maybeStartAction(effectiveMessage);
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
          selectedGoalID: undefined,
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
          <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', marginStart: 8 }}>{t('newConversation')}</Text>
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
              backgroundColor: conv.id === activeConversationId ? alpha(colors.primary, 0.2) : 'transparent',
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
                marginStart: 8,
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
            backgroundColor: alpha(colors.primary, 0.133),
            borderWidth: 1,
            borderColor: alpha(colors.primary, 0.267),
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <Sparkles size={32} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center', marginBottom: 8 }}>
          How can CoAI help with your money today?
        </Text>
        <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 20, maxWidth: 560, alignSelf: 'center', lineHeight: 22 }}>
          Ask questions, attach receipts, or let CoAI guide you into transactions, budgets, goals, and conversions.
        </Text>
        {quickPrompts.length > 0 && (
          <View style={{ width: '100%' }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {quickPrompts.map((prompt) => (
                <Pressable
                  key={prompt}
                  onPress={() => handleSend(prompt)}
                  accessibilityRole="button"
                  accessibilityLabel={prompt}
                  style={({ pressed }) => [{
                    minHeight: 36,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 9999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.cardElevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }, pressed && { opacity: 0.75 }]}
                >
                  <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                    {prompt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderMessages = () => {
    const listEmptyContent = () => {
      if (loadingMessages && activeConversationId && messages.length === 0) {
        return (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        );
      }
      if (!aiConfigured) {
        return (
          <EmptyState
            icon={Sparkles}
            title={t('youAreOffline') || 'You are offline'}
            description="The server is missing an AI configuration. Please add an AI_API_KEY and redeploy."
          />
        );
      }
      return renderWelcome();
    };

    const footerContent = isTyping || pendingAction || streamingDraft || streamInterrupted ? (
      <View style={{ gap: 16 }}>
        {streamingDraft.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', width: '100%', alignItems: 'flex-start' }}>
            <View>
              <View
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: streamInterrupted ? alpha(colors.danger, 0.267) : colors.border,
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
              {streamInterrupted && (
                <Pressable
                  onPress={() => {
                    setStreamInterrupted(false);
                    setStreamingDraft('');
                    streamingDraftRef.current = '';
                    if (lastSentMessageRef.current) {
                      handleSend(lastSentMessageRef.current);
                    }
                  }}
                  style={({ pressed }) => [{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor: alpha(colors.danger, 0.08),
                    borderWidth: 1,
                    borderColor: alpha(colors.danger, 0.2),
                    alignSelf: 'flex-start',
                  }, pressed && { opacity: 0.7 }]}
                >
                  <AlertTriangle size={12} color={colors.danger} />
                  <Text style={{ color: colors.danger, fontSize: 11, marginStart: 5, fontFamily: 'Inter_500Medium' }}>
                    {t('responseInterrupted') || 'Response interrupted'} · {t('tapToRetry') || 'Tap to retry'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {isTyping && !streamingDraft && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', width: '100%', alignItems: 'flex-end' }}>
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: 18, borderBottomLeftRadius: 6, maxWidth: '90%' }}>
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
          <ChatPendingActionFlow
            pendingAction={pendingAction}
            onDismiss={() => setPendingAction(null)}
            onApplyTransaction={(parsed) => applyParsedMutation.mutate(parsed)}
            isApplyingTransaction={applyParsedMutation.isPending}
            onApplyRecurring={(parsed, frequency) => applyRecurringMutation.mutate({ parsed, frequency })}
            isApplyingRecurring={applyRecurringMutation.isPending}
            onApplyGoalContribution={(data) => applyGoalContributionMutation.mutate(data)}
            isApplyingGoalContribution={applyGoalContributionMutation.isPending}
            onApplyConversion={(data) => walletConvertMutation.mutate(data)}
            onSetFrequency={(freq) => setPendingAction(prev =>
              prev?.kind === 'recurring' ? { ...prev, selectedFrequency: freq } : prev
            )}
            onSetGoalID={(goalId) => setPendingAction(prev =>
              prev?.kind === 'goal_contribution' ? { ...prev, selectedGoalID: goalId } : prev
            )}
            onSetError={setSendError}
          />
        )}
      </View>
    ) : null;

    return (
      <FlatList
        ref={scrollViewRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        style={contentWidthStyle}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={maybeAutoScroll}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xl,
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg) + 122,
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
            <ChatHeader
              aiConfigured={aiConfigured}
              aiRateLimitPerMinute={aiRateLimitPerMinute}
              onNewConversation={handleNewConversation}
              onActivityPress={() => {
                setSelectedActivityMessageID(liveTrace.length > 0 ? null : latestAssistantMessageID);
                setIsActivityModalVisible(true);
              }}
              onUsagePress={() => setIsUsageModalVisible(true)}
              contentWidthStyle={contentWidthStyle}
            />

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
                    <Text style={{ color: colors.primaryForeground, fontSize: 14, marginStart: 4 }}>{t('newConversation')}</Text>
                  </Pressable>
                  {conversations.map((conv) => (
                    <Pressable
                      key={conv.id}
                      onPress={() => handleSelectConversation(conv.id)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 9999,
                        backgroundColor: conv.id === activeConversationId ? alpha(colors.primary, 0.2) : colors.card,
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
            <ChatInputComposer
              message={message}
              setMessage={setMessage}
              onSend={() => handleSend()}
              thinkingMode={thinkingMode}
              setThinkingMode={setThinkingMode}
              attachment={attachment}
              onAttach={showAttachmentPicker}
              onClearAttachment={clearAttachment}
              isRecording={isRecordingVoice}
              onCancelVoice={cancelVoice}
              onVoiceComplete={handleVoiceComplete}
              onVoiceError={(msg) => showToast(msg, 'error')}
              isSending={sendMessageMutation.isPending}
              canSend={canSendMessage}
              maxLength={MAX_MESSAGE_LENGTH}
              charCountThreshold={CHAR_COUNT_THRESHOLD}
              inputPlaceholder={inputPlaceholder}
              aiRateLimitPerMinute={aiRateLimitPerMinute}
              aiRateLimitBurst={aiRateLimitBurst}
              sendError={sendError}
              lastFailedMessage={lastFailedMessage}
              onRetry={handleRetry}
            />
          </View>
        </View>

        <ChatActivityModal
          visible={isActivityModalVisible}
          onClose={() => setIsActivityModalVisible(false)}
          traceEvents={activeTraceEvents}
          toolUsage={activeToolUsage}
        />

        <ChatUsageModal
          visible={isUsageModalVisible}
          onClose={() => setIsUsageModalVisible(false)}
          usageSummary={usageSummary}
          windowDays={usageWindowDays}
          onWindowChange={setUsageWindowDays}
          isLoading={isUsageSummaryLoading}
        />

        <Modal
          visible={!!tableModalContent}
          animationType="slide"
          onRequestClose={() => setTableModalContent(null)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Table2 size={15} color={colors.accent} />
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 15, marginStart: 7 }}>
                  {tableModalContent?.title || 'Table'}
                </Text>
              </View>
              <Pressable
                onPress={() => setTableModalContent(null)}
                accessibilityRole="button"
                accessibilityLabel={t('a11yClose') || 'Close'}
                hitSlop={8}
              >
                <Text style={{ color: colors.mutedForeground }}>{t('close') || 'Close'}</Text>
              </Pressable>
            </View>
            <ScrollView horizontal style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ padding: 14, minWidth: width - 20 }}>
                <Markdown style={markdownStyles}>{tableModalContent?.markdown || ''}</Markdown>
              </ScrollView>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
