import { useState, useMemo } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MessageCircle, Plus, Search, X } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';
import { ConversationListItem } from './ConversationListItem';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onConversationDelete: (id: string) => void;
  onConversationRename: (id: string, newTitle: string) => void;
  onNewConversation: () => void;
  isLoadingConversations?: boolean;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onConversationSelect,
  onConversationDelete,
  onConversationRename,
  onNewConversation,
  isLoadingConversations,
}: ConversationSidebarProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;

    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => conv.title.toLowerCase().includes(query));
  }, [conversations, searchQuery]);

  return (
    <View
      style={{
        width: 280,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header */}
      <View
        style={{
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: theme.colors.foreground }}>
            {t('conversations') || 'Conversations'}
          </Text>
          <Pressable
            onPress={onNewConversation}
            accessibilityRole="button"
            accessibilityLabel={t('newConversation') || 'New conversation'}
            hitSlop={8}
            style={({ pressed }) => [
              {
                padding: 6,
                borderRadius: 6,
                backgroundColor: theme.colors.secondary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Plus size={16} color={theme.colors.foreground} />
          </Pressable>
        </View>

        {/* Search Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.secondary,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            gap: 8,
          }}
        >
          <Search size={16} color={theme.colors.mutedForeground} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('searchConversations') || 'Search conversations...'}
            placeholderTextColor={theme.colors.mutedForeground}
            style={{
              flex: 1,
              color: theme.colors.foreground,
              fontSize: 14,
              padding: 0,
            }}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={16} color={theme.colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Conversation List */}
      <ScrollView style={{ flex: 1 }}>
        {isLoadingConversations ? (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: 14 }}>
              {t('loading') || 'Loading...'}
            </Text>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={{ padding: 16, alignItems: 'center', gap: 8 }}>
            <MessageCircle size={32} color={theme.colors.mutedForeground} />
            <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, textAlign: 'center' }}>
              {searchQuery
                ? t('noConversationsFound') || 'No conversations found'
                : t('noConversations') || 'No conversations yet'}
            </Text>
          </View>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              onSelect={() => onConversationSelect(conv.id)}
              onDelete={() => onConversationDelete(conv.id)}
              onRename={(newTitle) => onConversationRename(conv.id, newTitle)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
