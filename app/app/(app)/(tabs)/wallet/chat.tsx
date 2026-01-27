import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import type { ChatMessage, Conversation } from '../../../../src/api/chat';

const suggestedQuestions = [
  'How am I doing financially?',
  'What are my top spending categories?',
  'Am I on track with my savings goals?',
  'How can I save more money?',
  'How much did I spend this month?',
];

export default function AIChatScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId || null
  );
  const scrollViewRef = useRef<ScrollView>(null);

  // Fetch conversations list
  const { data: conversationsData } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api.chat.listConversations(),
  });

  // Fetch current conversation messages
  const { data: currentConversation, isLoading: loadingMessages } = useQuery({
    queryKey: ['ai-conversation', activeConversationId],
    queryFn: () =>
      activeConversationId ? api.chat.getConversation(activeConversationId) : null,
    enabled: !!activeConversationId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (msg: string) =>
      api.chat.sendMessage({
        conversation_id: activeConversationId || undefined,
        message: msg,
      }),
    onSuccess: (data) => {
      if (!activeConversationId) {
        setActiveConversationId(data.conversation_id);
      }
      queryClient.invalidateQueries({
        queryKey: ['ai-conversation', data.conversation_id],
      });
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      setIsTyping(false);
    },
    onError: () => {
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

  const messages: ChatMessage[] = currentConversation?.messages || [];
  const conversations: Conversation[] = conversationsData?.conversations || [];

  // Scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!message.trim() || sendMessageMutation.isPending) return;
    setIsTyping(true);
    sendMessageMutation.mutate(message.trim());
    setMessage('');
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  const renderSidebar = () => (
    <View
      className={`${
        isDesktop ? 'w-72' : 'w-full'
      } bg-card border-r border-border flex-col`}
      style={isDesktop ? { height: '100%' } : { maxHeight: 200 }}
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
              className="p-1"
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
      <View
        className="flex-row flex-wrap justify-center gap-2"
        style={{ maxWidth: 500 }}
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

  const renderMessages = () => (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1 p-4"
      contentContainerStyle={{ gap: 16 }}
    >
      {loadingMessages && activeConversationId ? (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
        </View>
      ) : messages.length === 0 ? (
        renderWelcome()
      ) : (
        <>
          {messages.map((msg) => (
            <View
              key={msg.id}
              className={`flex-row ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <View
                className={`flex-row max-w-[85%] ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
                style={{ gap: 12 }}
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
          ))}

          {isTyping && (
            <View className="flex-row justify-start">
              <View className="flex-row" style={{ gap: 12 }}>
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
        </>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View
          className="flex-row items-center p-4 border-b border-border bg-card"
          style={{ maxWidth: isDesktop ? undefined : '100%' }}
        >
          <Pressable
            onPress={() => router.back()}
            className="p-2 mr-2"
            style={{ cursor: 'pointer' }}
          >
            <ArrowLeft size={24} color="rgb(248, 250, 252)" />
          </Pressable>
          <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
            <Bot size={16} color="#09090b" />
          </View>
          <View className="ml-3">
            <Text className="font-semibold text-foreground">{t('aiAdvisor')}</Text>
            <Text className="text-xs text-muted-foreground">{t('aiAdvisorDesc')}</Text>
          </View>
        </View>

        <View className="flex-1 flex-row">
          {/* Sidebar for Desktop */}
          {isDesktop && renderSidebar()}

          {/* Main Chat Area */}
          <View className="flex-1 flex-col">
            {/* Mobile Conversations Carousel */}
            {!isDesktop && conversations.length > 0 && (
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
            )}

            {/* Messages */}
            {renderMessages()}

            {/* Input */}
            <View className="p-4 border-t border-border bg-card">
              <View
                className="flex-row items-center"
                style={{ gap: 12, maxWidth: isDesktop ? 800 : '100%', alignSelf: 'center', width: '100%' }}
              >
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('typeMessage')}
                  placeholderTextColor="rgb(148, 163, 184)"
                  onSubmitEditing={handleSend}
                  editable={!sendMessageMutation.isPending}
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                  style={{ outlineStyle: 'none' } as any}
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
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
