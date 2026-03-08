import { useState } from 'react';
import { View, Text, Pressable, Image, ActionSheetIOS, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Paperclip, Camera, ImageIcon, FileText, Mic, X } from 'lucide-react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';
import type { ChatAttachment } from '../../../api/chat';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface AttachmentPickerProps {
  onAttach: (attachment: ChatAttachment) => void;
  onStartVoice: () => void;
  attachment: ChatAttachment | null;
  onRemove: () => void;
}

export function AttachmentButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const colors = theme.colors;
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ cursor: 'pointer', padding: 8 }}>
      <Paperclip size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

export function AttachmentPreview({ attachment, onRemove }: { attachment: ChatAttachment; onRemove: () => void }) {
  const theme = useTheme();
  const colors = theme.colors;
  const isImage = attachment.mimeType.startsWith('image/');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8, backgroundColor: colors.secondary }}>
      {isImage ? (
        <Image
          source={{ uri: attachment.uri }}
          style={{ width: 40, height: 40, borderRadius: 6 }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}>
          <FileText size={18} color={colors.mutedForeground} />
        </View>
      )}
      <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }} numberOfLines={1}>{attachment.name}</Text>
      <Pressable onPress={onRemove} hitSlop={8} style={{ cursor: 'pointer', padding: 4 }}>
        <X size={16} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

export function useAttachmentPicker() {
  const { t } = useLanguage();
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const showPicker = () => {
    haptics.light();
    const options = [
      t('takePhoto') || 'Take Photo',
      t('chooseFromLibrary') || 'Choose from Library',
      t('chooseDocument') || 'Choose Document',
      t('voiceMessage') || 'Voice Message',
      t('cancel') || 'Cancel',
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 4,
        },
        (index) => handleOption(index),
      );
    } else {
      // Android - use Alert as simple action sheet
      Alert.alert(
        t('attachFile') || 'Attach File',
        undefined,
        [
          { text: options[0], onPress: () => handleOption(0) },
          { text: options[1], onPress: () => handleOption(1) },
          { text: options[2], onPress: () => handleOption(2) },
          { text: options[3], onPress: () => handleOption(3) },
          { text: options[4], style: 'cancel' },
        ],
      );
    }
  };

  const handleOption = async (index: number) => {
    switch (index) {
      case 0: // Camera
        await pickFromCamera();
        break;
      case 1: // Photo Library
        await pickFromLibrary();
        break;
      case 2: // Document
        await pickDocument();
        break;
      case 3: // Voice
        setIsRecordingVoice(true);
        break;
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
        Alert.alert(t('fileTooLarge') || 'File too large', t('fileTooLargeDetail') || 'Please choose a file smaller than 10MB');
        return;
      }
      setAttachment({
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        name: asset.fileName || `photo_${Date.now()}.jpg`,
        size: asset.fileSize,
      });
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
        Alert.alert(t('fileTooLarge') || 'File too large', t('fileTooLargeDetail') || 'Please choose a file smaller than 10MB');
        return;
      }
      setAttachment({
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        name: asset.fileName || `image_${Date.now()}.jpg`,
        size: asset.fileSize,
      });
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/csv'],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_FILE_SIZE) {
        Alert.alert(t('fileTooLarge') || 'File too large', t('fileTooLargeDetail') || 'Please choose a file smaller than 10MB');
        return;
      }
      setAttachment({
        uri: asset.uri,
        mimeType: asset.mimeType || 'application/pdf',
        name: asset.name,
        size: asset.size,
      });
    }
  };

  const handleVoiceComplete = (uri: string, mimeType: string, name: string) => {
    setIsRecordingVoice(false);
    setAttachment({ uri, mimeType, name });
  };

  const clearAttachment = () => {
    setAttachment(null);
  };

  return {
    attachment,
    isRecordingVoice,
    showPicker,
    clearAttachment,
    handleVoiceComplete,
    cancelVoice: () => setIsRecordingVoice(false),
  };
}
