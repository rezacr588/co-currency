import { useEffect } from 'react';
import { Platform } from 'react-native';

interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'cmd' | 'shift' | 'alt')[];
  handler: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts: KeyboardShortcut[];
}

/**
 * Hook to register keyboard shortcuts for web platform
 * Shortcuts only work on web, no-op on native platforms
 */
export function useKeyboardShortcuts({ enabled = true, shortcuts }: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    // Only enable on web
    if (Platform.OS !== 'web' || !enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.platform);
      
      for (const shortcut of shortcuts) {
        const modifiers = shortcut.modifiers || [];
        const requiresCtrl = modifiers.includes('ctrl') || modifiers.includes('cmd');
        const requiresShift = modifiers.includes('shift');
        const requiresAlt = modifiers.includes('alt');

        // Check if modifiers match
        const ctrlPressed = isMac ? event.metaKey : event.ctrlKey;
        const shiftPressed = event.shiftKey;
        const altPressed = event.altKey;

        // Match key (case insensitive)
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();

        // Check if all conditions are met
        const modifiersMatch =
          (requiresCtrl ? ctrlPressed : !ctrlPressed || event.metaKey === false) &&
          (requiresShift ? shiftPressed : !shiftPressed) &&
          (requiresAlt ? altPressed : !altPressed);

        if (keyMatches && modifiersMatch) {
          // Prevent default only if we have a matching shortcut
          if (requiresCtrl || requiresShift || requiresAlt) {
            event.preventDefault();
          }
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, shortcuts]);
}

/**
 * Common keyboard shortcuts for chat interface
 */
export function useChatKeyboardShortcuts({
  enabled = true,
  onNewConversation,
  onFocusInput,
  onToggleSidebar,
  onFocusSearch,
  onNavigateUp,
  onNavigateDown,
  onEscape,
}: {
  enabled?: boolean;
  onNewConversation?: () => void;
  onFocusInput?: () => void;
  onToggleSidebar?: () => void;
  onFocusSearch?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onEscape?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [
    ...(onNewConversation ? [{
      key: 'k',
      modifiers: ['cmd' as const],
      handler: onNewConversation,
      description: 'New conversation',
    }] : []),
    ...(onFocusInput ? [{
      key: '/',
      modifiers: ['cmd' as const],
      handler: onFocusInput,
      description: 'Focus message input',
    }] : []),
    ...(onToggleSidebar ? [{
      key: 'b',
      modifiers: ['cmd' as const],
      handler: onToggleSidebar,
      description: 'Toggle sidebar',
    }] : []),
    ...(onFocusSearch ? [{
      key: 'f',
      modifiers: ['cmd' as const],
      handler: onFocusSearch,
      description: 'Focus search',
    }] : []),
    ...(onNavigateUp ? [{
      key: 'ArrowUp',
      handler: onNavigateUp,
      description: 'Navigate up',
    }] : []),
    ...(onNavigateDown ? [{
      key: 'ArrowDown',
      handler: onNavigateDown,
      description: 'Navigate down',
    }] : []),
    ...(onEscape ? [{
      key: 'Escape',
      handler: onEscape,
      description: 'Close modal or clear input',
    }] : []),
  ];

  useKeyboardShortcuts({ enabled, shortcuts });
}
