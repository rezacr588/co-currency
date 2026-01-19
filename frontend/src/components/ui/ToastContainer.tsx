import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import { Toast } from './Toast';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={removeToast} />
        </div>
      ))}
    </div>,
    document.body
  );
}

ToastContainer.displayName = 'ToastContainer';
