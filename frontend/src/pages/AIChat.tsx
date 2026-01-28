import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Send, Bot, User, Plus, Trash2, ArrowLeft, Sparkles } from 'lucide-react';
import { api } from '../api';
import { ROUTES } from '../constants/routes';
import type { ChatMessage, Conversation, ConversationWithMessages } from '../api/chat';

const suggestedQuestions = [
    "How am I doing financially?",
    "What are my top spending categories?",
    "Am I on track with my savings goals?",
    "How can I save more money?",
    "How much did I spend this month?",
];

export default function AIChat() {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { conversationId } = useParams<{ conversationId?: string }>();
    const [message, setMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(
        conversationId || null
    );
    const streamingStateRef = useRef<{ conversationId: string; messageId: string } | null>(null);
    const optimisticConversationIdRef = useRef<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedConversationId = activeConversationId || conversationId || '';

    // Fetch conversations list
    const { data: conversationsData } = useQuery({
        queryKey: ['ai-conversations'],
        queryFn: () => api.chat.listConversations(),
    });

    // Fetch current conversation messages
    const canFetchConversation =
        !!selectedConversationId && !selectedConversationId.startsWith('temp-');
    const { data: currentConversation, isLoading: loadingMessages } = useQuery({
        queryKey: ['ai-conversation', selectedConversationId],
        queryFn: () =>
            selectedConversationId ? api.chat.getConversation(selectedConversationId) : null,
        enabled: canFetchConversation,
    });

    useEffect(() => {
        if (conversationId) {
            setActiveConversationId(conversationId);
            optimisticConversationIdRef.current = null;
        } else if (!optimisticConversationIdRef.current) {
            setActiveConversationId(null);
        }
    }, [conversationId]);

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

    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: async (msg: string) => {
            const optimisticConversationId =
                optimisticConversationIdRef.current || selectedConversationId;
            try {
                return await api.chat.streamMessage(
                    {
                        conversation_id: selectedConversationId || undefined,
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
                    conversation_id: selectedConversationId || undefined,
                    message: msg,
                });
            }
        },
        onMutate: async (msg) => {
            setIsTyping(true);
            const now = new Date().toISOString();
            const optimisticMessage: ChatMessage = {
                id: `temp-${Date.now()}`,
                conversation_id: selectedConversationId || 'temp',
                role: 'user',
                content: msg,
                created_at: now,
            };

            if (selectedConversationId) {
                queryClient.setQueryData<ConversationWithMessages | null>(
                    ['ai-conversation', selectedConversationId],
                    (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            messages: [...(old.messages ?? []), optimisticMessage],
                        };
                    }
                );
                optimisticConversationIdRef.current = selectedConversationId;
                return { optimisticConversationId: selectedConversationId };
            }

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
            optimisticConversationIdRef.current = optimisticConversationId;
            return { optimisticConversationId };
        },
        onSuccess: (data) => {
            const serverConversationId = data.conversation_id;
            if (
                optimisticConversationIdRef.current &&
                optimisticConversationIdRef.current !== serverConversationId
            ) {
                const tempId = optimisticConversationIdRef.current;
                const tempData = queryClient.getQueryData<ConversationWithMessages>([
                    'ai-conversation',
                    tempId,
                ]);
                if (tempData) {
                    queryClient.setQueryData<ConversationWithMessages>(
                        ['ai-conversation', serverConversationId],
                        tempData
                    );
                    queryClient.removeQueries({ queryKey: ['ai-conversation', tempId] });
                }

                queryClient.setQueryData<{ conversations: Conversation[] } | undefined>(
                    ['ai-conversations'],
                    (old) => {
                        if (!old) return old;
                        const updated = old.conversations.map((conv) =>
                            conv.id === tempId ? { ...conv, id: serverConversationId } : conv
                        );
                        return { conversations: updated };
                    }
                );

                setActiveConversationId(serverConversationId);
                if (streamingStateRef.current?.conversationId === tempId) {
                    streamingStateRef.current = {
                        conversationId: serverConversationId,
                        messageId: streamingStateRef.current.messageId,
                    };
                }
            }

            if (!conversationId) {
                navigate(`${ROUTES.aiChat}/${serverConversationId}`);
            }

            finalizeStreamingAssistant(serverConversationId, data.message);
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            setIsTyping(false);
            optimisticConversationIdRef.current = null;
        },
        onError: () => {
            setIsTyping(false);
            if (optimisticConversationIdRef.current?.startsWith('temp-')) {
                queryClient.removeQueries({
                    queryKey: ['ai-conversation', optimisticConversationIdRef.current],
                });
                queryClient.setQueryData<{ conversations: Conversation[] } | undefined>(
                    ['ai-conversations'],
                    (old) => {
                        if (!old) return old;
                        return {
                            conversations: old.conversations.filter(
                                (conv) => conv.id !== optimisticConversationIdRef.current
                            ),
                        };
                    }
                );
            }
            streamingStateRef.current = null;
            optimisticConversationIdRef.current = null;
        },
    });

    // Delete conversation mutation
    const deleteConversationMutation = useMutation({
        mutationFn: (id: string) => api.chat.deleteConversation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            if (conversationId) navigate(ROUTES.aiChat);
            setActiveConversationId(null);
        },
    });

    const messages: ChatMessage[] = currentConversation?.messages || [];
    const conversations: Conversation[] = conversationsData?.conversations || [];

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, [conversationId]);

    const handleSend = () => {
        if (!message.trim() || sendMessageMutation.isPending) return;
        sendMessageMutation.mutate(message.trim());
        setMessage('');
    };

    const handleNewConversation = () => {
        setIsTyping(false);
        setActiveConversationId(null);
        optimisticConversationIdRef.current = null;
        streamingStateRef.current = null;
        navigate(ROUTES.aiChat);
    };

    const handleSelectConversation = (id: string) => {
        setIsTyping(false);
        setActiveConversationId(id);
        optimisticConversationIdRef.current = null;
        streamingStateRef.current = null;
        navigate(`${ROUTES.aiChat}/${id}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
            {/* Sidebar - Conversations */}
            <div className="hidden md:flex w-72 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <button
                        onClick={handleNewConversation}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg shadow-primary-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        {t('newConversation') || 'New Chat'}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {conversations.map((conv) => (
                        <div
                            key={conv.id}
                            className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${conv.id === selectedConversationId
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                            onClick={() => handleSelectConversation(conv.id)}
                        >
                            <Bot className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1 truncate text-sm">{conv.title}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteConversationMutation.mutate(conv.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(ROUTES.dashboard)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors md:hidden"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h1 className="font-semibold text-slate-800 dark:text-white text-sm">
                                    {t('aiAdvisor') || 'Finance Advisor'}
                                </h1>
                                <p className="text-xs text-slate-500">{t('aiAdvisorDesc') || 'Powered by AI'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!selectedConversationId && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                                {t('aiWelcome') || 'Hi! I\'m your Finance Advisor'}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                                {t('aiWelcomeDesc') || 'Ask me anything about your finances. I have access to your transactions, budgets, and goals.'}
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {suggestedQuestions.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setMessage(q);
                                            inputRef.current?.focus();
                                        }}
                                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-700 dark:text-slate-300 hover:border-primary-500 hover:text-primary-600 transition-colors"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {loadingMessages && selectedConversationId && (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] md:max-w-[70%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''
                                    }`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user'
                                        ? 'bg-slate-200 dark:bg-slate-700'
                                        : 'bg-gradient-to-br from-primary-500 to-primary-600'
                                        }`}
                                >
                                    {msg.role === 'user' ? (
                                        <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                    ) : (
                                        <Bot className="w-4 h-4 text-white" />
                                    )}
                                </div>
                                <div
                                    className={`px-4 py-3 rounded-2xl ${msg.role === 'user'
                                        ? 'bg-primary-600 text-white rounded-br-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-sm'
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl rounded-bl-sm shadow-sm">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex gap-2 max-w-4xl mx-auto">
                        <input
                            ref={inputRef}
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('typeMessage') || 'Ask about your finances...'}
                            disabled={sendMessageMutation.isPending}
                            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!message.trim() || sendMessageMutation.isPending}
                            className="px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/20"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
