import { useEffect, useState as useStateToast } from 'react';
import { View, Text, Pressable, Animated, Keyboard, Platform } from 'react-native';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { ICON_SIZES } from '../../constants/icons';
import { useTheme } from 'styled-components/native';
import { HIT_SLOP_SM } from '../../constants/hitSlop';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: () => void;
}

const variantIcons: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
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
  const Icon = variantIcons[variant];
  const [keyboardHeight, setKeyboardHeight] = useStateToast(0);

  const variantBgColors: Record<ToastVariant, string> = {
    success: theme.alpha(colors.success, 0.9),
    error: theme.alpha(colors.danger, 0.9),
    warning: theme.alpha(colors.warning, 0.9),
    info: theme.alpha(colors.primary, 0.9),
  };

  const variantFgColors: Record<ToastVariant, string> = {
    success: colors.primaryForeground,
    error: colors.primaryForeground,
    warning: colors.accentForeground,
    info: colors.primaryForeground,
  };
  const fgColor = variantFgColors[variant];

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
        <Icon size={ICON_SIZES.default} color={fgColor} />
        <Text
          style={{ flex: 1, marginHorizontal: 12, fontFamily: 'Inter_500Medium', color: fgColor }}
          numberOfLines={2}
        >
          {message}
        </Text>
        <Pressable onPress={onDismiss} hitSlop={HIT_SLOP_SM} style={{ padding: 4 }}>
          <X size={ICON_SIZES.md} color={fgColor} />
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
