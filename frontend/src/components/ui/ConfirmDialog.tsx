import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  const iconColor = variant === 'danger'
    ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
    : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400';

  const icon = variant === 'danger' ? (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ) : (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" closeOnBackdrop={!loading}>
      <div className="text-center">
        {/* Icon */}
        <div className={`mx-auto w-12 h-12 rounded-full ${iconColor} flex items-center justify-center mb-4`}>
          {icon}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            loading={loading}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

ConfirmDialog.displayName = 'ConfirmDialog';
