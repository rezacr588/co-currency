import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast } from './Toast';
import type { Toast as ToastType } from '../../context/ToastContext';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function createToast(overrides: Partial<ToastType> = {}): ToastType {
  return {
    id: 'toast-1',
    type: 'success',
    message: 'Test message',
    duration: 5000,
    ...overrides,
  };
}

describe('Toast', () => {
  it('should render toast with message', () => {
    const toast = createToast({ message: 'Operation successful!' });
    const onDismiss = vi.fn();

    render(<Toast toast={toast} onDismiss={onDismiss} />);

    expect(screen.getByText('Operation successful!')).toBeInTheDocument();
  });

  it('should have alert role for accessibility', () => {
    const toast = createToast();
    render(<Toast toast={toast} onDismiss={vi.fn()} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should render different toast types', () => {
    const types: Array<ToastType['type']> = ['success', 'error', 'warning', 'info'];

    for (const type of types) {
      const toast = createToast({ id: `toast-${type}`, type, message: `${type} toast` });
      const { unmount } = render(<Toast toast={toast} onDismiss={vi.fn()} />);
      expect(screen.getByText(`${type} toast`)).toBeInTheDocument();
      unmount();
    }
  });

  it('should call onDismiss with toast id when dismiss button is clicked', () => {
    const toast = createToast({ id: 'toast-42' });
    const onDismiss = vi.fn();

    render(<Toast toast={toast} onDismiss={onDismiss} />);

    const dismissButton = screen.getByLabelText('Dismiss notification');
    fireEvent.click(dismissButton);

    // The dismiss has a 200ms animation delay, wrap in act to flush state updates
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onDismiss).toHaveBeenCalledWith('toast-42');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should clean up timers on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const toast = createToast();
    const onDismiss = vi.fn();

    const { unmount } = render(<Toast toast={toast} onDismiss={onDismiss} />);

    unmount();

    // The cleanup function should have called clearTimeout for the enter animation timer
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('should clean up dismiss timer on unmount after clicking dismiss', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const toast = createToast();
    const onDismiss = vi.fn();

    const { unmount } = render(<Toast toast={toast} onDismiss={onDismiss} />);

    // Click dismiss to start the animation timer
    const dismissButton = screen.getByLabelText('Dismiss notification');
    fireEvent.click(dismissButton);

    // Unmount before the 200ms animation completes
    unmount();

    // clearTimeout should be called during cleanup
    expect(clearTimeoutSpy).toHaveBeenCalled();
    // onDismiss should NOT have been called since we unmounted before the timer fired
    expect(onDismiss).not.toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('should trigger enter animation after mount', () => {
    const toast = createToast();
    render(<Toast toast={toast} onDismiss={vi.fn()} />);

    const alertEl = screen.getByRole('alert');

    // Before the 10ms timer fires, the element should not be fully visible
    expect(alertEl.className).toContain('opacity-0');

    // After the enter animation timer fires, wrap in act() to flush state updates
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(alertEl.className).toContain('opacity-100');
  });
});
