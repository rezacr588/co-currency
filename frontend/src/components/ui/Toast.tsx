import { useEffect, useState } from 'react';
import type { Toast as ToastType, ToastType as ToastVariant } from '../../context/ToastContext';

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const iconsByType: Record<ToastVariant, JSX.Element> = {
  success: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const stylesByType: Record<ToastVariant, string> = {
  success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  error: 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200',
  warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
  info: 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 text-primary-800 dark:text-primary-200',
};

const iconStylesByType: Record<ToastVariant, string> = {
  success: 'text-emerald-500 dark:text-emerald-400',
  error: 'text-rose-500 dark:text-rose-400',
  warning: 'text-amber-500 dark:text-amber-400',
  info: 'text-primary-500 dark:text-primary-400',
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(enterTimer);
  }, []);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm
        transform transition-all duration-200 ease-out
        ${stylesByType[toast.type]}
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${iconStylesByType[toast.type]}`}>
        {iconsByType[toast.type]}
      </div>

      {/* Message */}
      <p className="flex-1 text-sm font-medium">
        {toast.message}
      </p>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

Toast.displayName = 'Toast';
