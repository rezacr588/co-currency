import { useEffect } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { ICON_SIZES } from '../../constants/icons';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: () => void;
}

const variantStyles: Record<ToastVariant, { bg: string; icon: typeof CheckCircle; color: string }> = {
  success: {
    bg: 'bg-success/90',
    icon: CheckCircle,
    color: 'rgb(255, 255, 255)',
  },
  error: {
    bg: 'bg-danger/90',
    icon: AlertCircle,
    color: 'rgb(255, 255, 255)',
  },
  warning: {
    bg: 'bg-warning/90',
    icon: AlertTriangle,
    color: 'rgb(15, 26, 42)',
  },
  info: {
    bg: 'bg-primary/90',
    icon: Info,
    color: 'rgb(255, 255, 255)',
  },
};

export function Toast({
  visible,
  message,
  variant = 'info',
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <View className="absolute bottom-20 left-4 right-4 z-50">
      <View className={`${styles.bg} p-4 rounded-xl flex-row items-center shadow-lg`}>
        <Icon size={ICON_SIZES.default} color={styles.color} />
        <Text
          className="flex-1 mx-3 font-medium"
          style={{ color: styles.color }}
          numberOfLines={2}
        >
          {message}
        </Text>
        <Pressable onPress={onDismiss} className="p-1">
          <X size={ICON_SIZES.md} color={styles.color} />
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
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    setToast({
      id: Date.now().toString(),
      message,
      variant,
    });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          visible={true}
          message={toast.message}
          variant={toast.variant}
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
