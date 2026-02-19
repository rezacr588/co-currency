import { useEffect, useState as useStateToast } from 'react';
import { View, Text, Pressable, Animated, Keyboard, Platform } from 'react-native';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { ICON_SIZES } from '../../constants/icons';
import { useTheme } from 'styled-components/native';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: () => void;
}

const variantConfig: Record<ToastVariant, { icon: typeof CheckCircle; color: string }> = {
  success: {
    icon: CheckCircle,
    color: 'rgb(255, 255, 255)',
  },
  error: {
    icon: AlertCircle,
    color: 'rgb(255, 255, 255)',
  },
  warning: {
    icon: AlertTriangle,
    color: 'rgb(15, 26, 42)',
  },
  info: {
    icon: Info,
    color: '#09090b',
  },
};

export function Toast({
  visible,
  message,
  variant = 'info',
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const config = variantConfig[variant];
  const Icon = config.icon;
  const [keyboardHeight, setKeyboardHeight] = useStateToast(0);

  const variantBgColors: Record<ToastVariant, string> = {
    success: colors.success + 'e6',
    error: colors.danger + 'e6',
    warning: colors.warning + 'e6',
    info: colors.primary + 'e6',
  };

  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  if (!visible) return null;

  const bottomOffset = keyboardHeight > 0 ? keyboardHeight + 16 : 80;

  return (
    <View style={{ position: 'absolute', left: 16, right: 16, zIndex: 50, bottom: bottomOffset }}>
      <View style={{ backgroundColor: variantBgColors[variant], padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}>
        <Icon size={ICON_SIZES.default} color={config.color} />
        <Text
          style={{ flex: 1, marginHorizontal: 12, fontFamily: 'Inter_500Medium', color: config.color }}
          numberOfLines={2}
        >
          {message}
        </Text>
        <Pressable onPress={onDismiss} style={{ padding: 4 }}>
          <X size={ICON_SIZES.md} color={config.color} />
        </Pressable>
      </View>
    </View>
  );
}

// Toast context for global toast management
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastQueue, setToastQueue] = useState<ToastData[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    setToastQueue((prev) => [
      ...prev,
      { id: Date.now().toString(), message, variant },
    ]);
  }, []);

  const dismissToast = useCallback(() => {
    setToastQueue((prev) => prev.slice(1));
  }, []);

  const currentToast = toastQueue[0] || null;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {currentToast && (
        <Toast
          key={currentToast.id}
          visible={true}
          message={currentToast.message}
          variant={currentToast.variant}
          onDismiss={dismissToast}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
