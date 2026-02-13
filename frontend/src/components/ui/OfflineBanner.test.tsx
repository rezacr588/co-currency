import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';

// Mock lucide-react WifiOff icon
vi.mock('lucide-react', () => ({
  WifiOff: (props: Record<string, unknown>) => <svg data-testid="wifi-off-icon" {...props} />,
}));

let originalOnLine: boolean;

beforeEach(() => {
  vi.useFakeTimers();
  originalOnLine = navigator.onLine;
});

afterEach(() => {
  vi.useRealTimers();
  // Restore navigator.onLine
  Object.defineProperty(navigator, 'onLine', {
    value: originalOnLine,
    writable: true,
    configurable: true,
  });
});

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value,
    writable: true,
    configurable: true,
  });
}

describe('OfflineBanner', () => {
  it('should not show banner when online', () => {
    setNavigatorOnline(true);

    render(<OfflineBanner />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should show banner when initially offline', () => {
    setNavigatorOnline(false);

    render(<OfflineBanner />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText("You're offline - some features may be limited")).toBeInTheDocument();
    expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument();
  });

  it('should show banner when going offline', () => {
    setNavigatorOnline(true);

    render(<OfflineBanner />);

    // Initially no banner
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Simulate going offline
    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText("You're offline - some features may be limited")).toBeInTheDocument();
  });

  it('should show "back online" message when reconnecting', () => {
    setNavigatorOnline(false);

    render(<OfflineBanner />);

    expect(screen.getByText("You're offline - some features may be limited")).toBeInTheDocument();

    // Simulate going back online
    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByText("You're back online!")).toBeInTheDocument();
  });

  it('should hide banner after going back online for 2 seconds', () => {
    setNavigatorOnline(false);

    render(<OfflineBanner />);

    expect(screen.getByRole('status')).toBeInTheDocument();

    // Go back online
    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByText("You're back online!")).toBeInTheDocument();

    // Advance past the 2s timer
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should clean up event listeners and timers on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    setNavigatorOnline(false);

    const { unmount } = render(<OfflineBanner />);

    // Go back online to start the timer
    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    unmount();

    // Verify event listeners are cleaned up
    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    // Verify timer is cleaned up
    expect(clearTimeoutSpy).toHaveBeenCalled();

    removeEventListenerSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('should cancel online timer when going offline again before it fires', () => {
    setNavigatorOnline(false);

    render(<OfflineBanner />);

    // Go online
    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByText("You're back online!")).toBeInTheDocument();

    // Go offline again before the 2s timer fires
    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText("You're offline - some features may be limited")).toBeInTheDocument();

    // Advance past the 2s — the banner should still be visible since we went offline
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText("You're offline - some features may be limited")).toBeInTheDocument();
  });
});
