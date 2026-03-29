import { memo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Edit2, MessageCircle, Trash2 } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';

interface ConversationListItemProps {
  conversation: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}

function ConversationListItemInner({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: ConversationListItemProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(conversation.title);

  const handleStartEdit = () => {
    setEditedTitle(conversation.title);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedTitle(conversation.title);
    setIsEditing(false);
  };

  const handleDeletePress = () => {
    Alert.alert(
      t('deleteConversation') || 'Delete Conversation',
      t('deleteConversationConfirm') || 'Are you sure you want to delete this conversation?',
      [
        {
          text: t('cancel') || 'Cancel',
          style: 'cancel',
        },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={isEditing ? undefined : onSelect}
      onLongPress={handleStartEdit}
      style={({ pressed }) => [
        {
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginHorizontal: 8,
          marginVertical: 2,
          borderRadius: 8,
          backgroundColor: isActive ? theme.colors.secondary : pressed ? theme.colors.muted : 'transparent',
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <MessageCircle size={16} color={isActive ? theme.colors.primary : theme.colors.mutedForeground} />
        
        {isEditing ? (
          <TextInput
            value={editedTitle}
            onChangeText={setEditedTitle}
            onBlur={handleSaveEdit}
            onSubmitEditing={handleSaveEdit}
            autoFocus
            selectTextOnFocus
            style={{
              flex: 1,
              color: theme.colors.foreground,
              fontSize: 14,
              fontFamily: 'Inter_500Medium',
              padding: 4,
              backgroundColor: theme.colors.background,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: theme.colors.primary,
            }}
          />
        ) : (
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: isActive ? theme.colors.foreground : theme.colors.mutedForeground,
              fontSize: 14,
              fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_500Medium',
            }}
          >
            {conversation.title}
          </Text>
        )}

        {!isEditing && (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable
              onPress={handleStartEdit}
              hitSlop={8}
              style={({ pressed }) => [
                {
                  padding: 4,
                  borderRadius: 4,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Edit2 size={14} color={theme.colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={handleDeletePress}
              hitSlop={8}
              style={({ pressed }) => [
                {
                  padding: 4,
                  borderRadius: 4,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Trash2 size={14} color={theme.colors.danger} />
            </Pressable>
          </View>
        )}
      </View>

      {!isEditing && (
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontSize: 11,
            marginTop: 4,
            marginLeft: 26,
          }}
        >
          {new Date(conversation.updated_at).toLocaleDateString()}
        </Text>
      )}
    </Pressable>
  );
}

export const ConversationListItem = memo(ConversationListItemInner);
