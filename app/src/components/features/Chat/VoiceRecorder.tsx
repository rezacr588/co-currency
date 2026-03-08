import { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Audio } from 'expo-av';
import { Mic, Square, X } from 'lucide-react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, mimeType: string, name: string) => void;
  onCancel: () => void;
  onError?: (message: string) => void;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, onError }: VoiceRecorderProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const MAX_DURATION = 120; // 2 minutes

  useEffect(() => {
    startRecording();
    return () => {
      stopTimer();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        onCancel();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      haptics.light();

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= MAX_DURATION) {
          handleStop();
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      haptics.error();
      onError?.(t('voiceRecordingFailed') || 'Failed to start voice recording');
      onCancel();
    }
  };

  const handleStop = async () => {
    stopTimer();
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      haptics.success();

      if (uri) {
        onRecordingComplete(uri, 'audio/m4a', `voice_${Date.now()}.m4a`);
      } else {
        onCancel();
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      haptics.error();
      onError?.(t('voiceStopFailed') || 'Failed to save recording');
      onCancel();
    }
  };

  const handleCancel = async () => {
    stopTimer();
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      recordingRef.current = null;
    }
    setIsRecording(false);
    haptics.light();
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, backgroundColor: colors.card }}>
      {/* Red pulsing dot */}
      <View
        style={{ width: 12, height: 12, borderRadius: 9999, backgroundColor: colors.danger, opacity: isRecording ? 1 : 0.5 }}
      />
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', minWidth: 45 }}>
        {formatTime(elapsed)}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 14, flex: 1 }}>
        {t('recording') || 'Recording...'}
      </Text>

      {/* Cancel */}
      <Pressable
        onPress={handleCancel}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('cancelRecording') || 'Cancel recording'}
        style={{ cursor: 'pointer', padding: 10 }}
      >
        <X size={20} color={colors.mutedForeground} />
      </Pressable>

      {/* Stop */}
      <Pressable
        onPress={handleStop}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('stopRecording') || 'Stop recording'}
        style={{ cursor: 'pointer', backgroundColor: colors.danger, padding: 12, borderRadius: 9999 }}
      >
        <Square size={16} color="#fff" fill="#fff" />
      </Pressable>
    </View>
  );
}
