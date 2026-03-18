import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Activity, Coins, Download, MoreVertical, Trash2, X } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '../../../context/LanguageContext';

interface ChatOverflowMenuProps {
  onActivityPress: () => void;
  onUsagePress: () => void;
  onExportPress?: () => void;
  onClearHistoryPress?: () => void;
}

export function ChatOverflowMenu({
  onActivityPress,
  onUsagePress,
  onExportPress,
  onClearHistoryPress,
}: ChatOverflowMenuProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      icon: Activity,
      label: t('activity') || 'Activity',
      onPress: () => {
        setIsOpen(false);
        onActivityPress();
      },
    },
    {
      icon: Coins,
      label: t('usage') || 'Usage',
      onPress: () => {
        setIsOpen(false);
        onUsagePress();
      },
    },
    ...(onExportPress
      ? [
          {
            icon: Download,
            label: t('exportConversation') || 'Export Conversation',
            onPress: () => {
              setIsOpen(false);
              onExportPress();
            },
          },
        ]
      : []),
    ...(onClearHistoryPress
      ? [
          {
            icon: Trash2,
            label: t('clearHistory') || 'Clear History',
            onPress: () => {
              setIsOpen(false);
              onClearHistoryPress();
            },
            destructive: true,
          },
        ]
      : []),
  ];

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('moreOptions') || 'More options'}
        hitSlop={8}
        style={({ pressed }) => [
          {
            padding: 8,
            borderRadius: 8,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <MoreVertical size={20} color={theme.colors.foreground} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setIsOpen(false)}
        >
          <View
            style={{
              position: 'absolute',
              top: 60,
              right: 16,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              minWidth: 200,
              overflow: 'hidden',
              ...theme.shadows.md,
            }}
          >
            {menuItems.map((item, index) => (
              <Pressable
                key={index}
                onPress={item.onPress}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
                    borderBottomColor: theme.colors.border,
                    backgroundColor: pressed ? theme.colors.muted : 'transparent',
                  },
                ]}
              >
                <item.icon
                  size={18}
                  color={item.destructive ? theme.colors.danger : theme.colors.foreground}
                />
                <Text
                  style={{
                    color: item.destructive ? theme.colors.danger : theme.colors.foreground,
                    fontSize: 14,
                    fontFamily: theme.typography.bodyMedium.fontFamily,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
