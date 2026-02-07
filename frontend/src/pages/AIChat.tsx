import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Send, Bot, User, Plus, Trash2, ArrowLeft, Sparkles, Menu, X } from 'lucide-react';
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
    const [sendError, setSendError] = useState<string | null>(null);
    const [isMobileConversationsOpen, setIsMobileConversationsOpen] = useState(false);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(
        conversationId || null
    );
    const optimisticConversationIdRef = useRef<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedConversationId = activeConversationId || conversationId || '';

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
    const canFetchConversation =
        !!selectedConversationId && !selectedConversationId.startsWith('temp-');
    const { data: currentConversation, isLoading: loadingMessages } = useQuery({
        queryKey: ['ai-conversation', selectedConversationId],
        queryFn: () =>
            selectedConversationId ? api.chat.getConversation(selectedConversationId) : null,
        enabled: canFetchConversation && aiConfigured,
    });

    useEffect(() => {
        if (conversationId) {
            setActiveConversationId(conversationId);
            optimisticConversationIdRef.current = null;
            setIsMobileConversationsOpen(false);
        } else if (!optimisticConversationIdRef.current) {
            setActiveConversationId(null);
        }
    }, [conversationId]);

    useEffect(() => {
        if (!isMobileConversationsOpen) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMobileConversationsOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isMobileConversationsOpen]);

    useEffect(() => {
        if (!isMobileConversationsOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobileConversationsOpen]);


    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: async (msg: string) => {
            // Only send conversation_id if it's a real UUID (not temp-)
            const realConversationId = selectedConversationId && !selectedConversationId.startsWith('temp-')
                ? selectedConversationId
                : undefined;
            return api.chat.sendMessage({
                conversation_id: realConversationId,
                message: msg,
            });
        },
        onMutate: async (msg) => {
            setIsTyping(true);
            setSendError(null);
            const now = new Date().toISOString();
            const optimisticMessageId = `temp-${Date.now()}`;
            const optimisticMessage: ChatMessage = {
                id: optimisticMessageId,
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
                return { optimisticConversationId: selectedConversationId, optimisticMessageId };
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
            return { optimisticConversationId, optimisticMessageId };
        },
        onSuccess: (data) => {
            const serverConversationId = data.conversation_id;

            // Validate response
            if (!serverConversationId || !data.message || !data.message.content) {
                setSendError('Received invalid response from server');
                setIsTyping(false);
                return;
            }

            // Handle optimistic conversation replacement
            if (
                optimisticConversationIdRef.current &&
                optimisticConversationIdRef.current !== serverConversationId
            ) {
                const tempId = optimisticConversationIdRef.current;

                // Get temp conversation data BEFORE removing it
                const tempData = queryClient.getQueryData<ConversationWithMessages>([
                    'ai-conversation',
                    tempId,
                ]);

                // Set data for real conversation, preserving user messages from temp
                queryClient.setQueryData<ConversationWithMessages>(
                    ['ai-conversation', serverConversationId],
                    {
                        conversation: {
                            id: serverConversationId,
                            user_id: tempData?.conversation.user_id || '',
                            title: tempData?.conversation.title || data.message.content.slice(0, 50),
                            created_at: tempData?.conversation.created_at || new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        },
                        messages: [
                            ...(tempData?.messages || []),
                            data.message,
                        ],
                    }
                );

                // Remove temp conversation data
                queryClient.removeQueries({ queryKey: ['ai-conversation', tempId] });

                // Update conversations list
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
            } else {
                // Existing conversation - just add the AI message
                queryClient.setQueryData<ConversationWithMessages | null>(
                    ['ai-conversation', serverConversationId],
                    (old) => {
                        if (!old) {
                            // This shouldn't happen for existing conversations, but handle it
                            const now = new Date().toISOString();
                            return {
                                conversation: {
                                    id: serverConversationId,
                                    user_id: '',
                                    title: data.message.content.slice(0, 50) || 'Conversation',
                                    created_at: now,
                                    updated_at: now,
                                },
                                messages: [data.message],
                            };
                        }
                        // Add message if it doesn't exist
                        const messageExists = old.messages.some(msg => msg.id === data.message.id);
                        if (messageExists) {
                            return old;
                        }
                        return {
                            ...old,
                            messages: [...old.messages, data.message],
                        };
                    }
                );
            }

            // Navigate to the conversation if we're not already there
            if (!conversationId) {
                navigate(`${ROUTES.aiChat}/${serverConversationId}`);
            }

            // Refresh conversations list
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            setIsTyping(false);
            optimisticConversationIdRef.current = null;
        },
        onError: (error, _msg, context) => {
            setIsTyping(false);
            setSendError(error instanceof Error ? error.message : 'Unable to reach the assistant. Please try again.');

            // Remove optimistic temp conversation (entire conversation for new chats)
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
            } else if (context?.optimisticConversationId && context.optimisticMessageId) {
                // For existing conversations, just remove the optimistic user message
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

            optimisticConversationIdRef.current = null;
        },
    });

    // Delete conversation mutation
    const deleteConversationMutation = useMutation({
        mutationFn: (id: string) => api.chat.deleteConversation(id),
        onSuccess: (_data, deletedId) => {
            // Invalidate both the conversations list and the specific conversation
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            queryClient.removeQueries({ queryKey: ['ai-conversation', deletedId] });

            if (conversationId) navigate(ROUTES.aiChat);
            setActiveConversationId(null);
        },
    });

    const messages: ChatMessage[] = useMemo(
        () => currentConversation?.messages || [],
        [currentConversation?.messages]
    );
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
        if (!message.trim() || sendMessageMutation.isPending || isTyping) return;
        if (!aiConfigured) {
            setSendError('AI is not configured on the server.');
            return;
        }
        sendMessageMutation.mutate(message.trim());
        setMessage('');
    };

    const handleNewConversation = () => {
        // Don't navigate if a message is being sent
        if (sendMessageMutation.isPending || isTyping) {
            return;
        }
        setIsTyping(false);
        setActiveConversationId(null);
        optimisticConversationIdRef.current = null;
        setSendError(null);
        navigate(ROUTES.aiChat);
    };

    const handleSelectConversation = (id: string) => {
        // Don't navigate if a message is being sent
        if (sendMessageMutation.isPending || isTyping) {
            return;
        }
        setIsTyping(false);
        setActiveConversationId(id);
        optimisticConversationIdRef.current = null;
        setSendError(null);
        navigate(`${ROUTES.aiChat}/${id}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const canChangeConversation = !sendMessageMutation.isPending && !isTyping;

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

            {/* Mobile Conversations Drawer */}
            {isMobileConversationsOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <button
                        type="button"
                        onClick={() => setIsMobileConversationsOpen(false)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        aria-label={t('closeMenu') || 'Close menu'}
                    />
                    <aside className="absolute left-0 top-0 h-full w-[86%] max-w-sm bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                            <button
                                onClick={() => {
                                    if (!canChangeConversation) return;
                                    handleNewConversation();
                                    setIsMobileConversationsOpen(false);
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium hover:from-primary-600 hover:to-primary-700 transition-all"
                                disabled={!canChangeConversation}
                            >
                                <Plus className="w-5 h-5" />
                                {t('newConversation') || 'New Chat'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsMobileConversationsOpen(false)}
                                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                aria-label={t('closeMenu') || 'Close menu'}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {conversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${conv.id === selectedConversationId
                                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!canChangeConversation) return;
                                            handleSelectConversation(conv.id);
                                            setIsMobileConversationsOpen(false);
                                        }}
                                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                        disabled={!canChangeConversation}
                                    >
                                        <Bot className="w-4 h-4 flex-shrink-0" />
                                        <span className="truncate text-sm">{conv.title}</span>
                                    </button>
                                    <button
                                        onClick={() => deleteConversationMutation.mutate(conv.id)}
                                        className="p-1.5 hover:text-red-500 rounded-md transition-colors"
                                        aria-label={t('deleteConversation') || 'Delete conversation'}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>
            )}

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
                    <button
                        type="button"
                        onClick={() => setIsMobileConversationsOpen(true)}
                        className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label={t('openMenu') || 'Open menu'}
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!aiConfigured && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-primary-500" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                                AI assistant is offline
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                                The server is missing an AI configuration. Please add an AI_API_KEY and redeploy.
                            </p>
                        </div>
                    )}

                    {aiConfigured && !selectedConversationId && messages.length === 0 && (
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
                                            if (!aiConfigured) return;
                                            setMessage(q);
                                            inputRef.current?.focus();
                                        }}
                                        disabled={!aiConfigured}
                                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-700 dark:text-slate-300 hover:border-primary-500 hover:text-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {sendError && (
                        <div className="max-w-4xl mx-auto mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                            {sendError}
                        </div>
                    )}
                    <div className="flex gap-2 max-w-4xl mx-auto">
                        <input
                            ref={inputRef}
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('typeMessage') || 'Ask about your finances...'}
                            disabled={sendMessageMutation.isPending || isTyping || !aiConfigured}
                            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!message.trim() || sendMessageMutation.isPending || isTyping || !aiConfigured}
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
