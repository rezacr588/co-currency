import type { ChatMessage, ChatStreamTraceEvent } from '../../../api/chat';
import type { SmartParseResponse } from '../../../types/wallet';
import type { ConversionResult } from '../../../types/currency';

export type PendingAction =
  | {
      kind: 'transaction';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      parsed?: SmartParseResponse;
      error?: string;
    }
  | {
      kind: 'recurring';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      parsed?: SmartParseResponse;
      selectedFrequency?: string;
      result?: unknown;
      error?: string;
    }
  | {
      kind: 'goal_contribution';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      parsed?: SmartParseResponse;
      selectedGoalID?: string;
      selectedGoalName?: string;
      goals?: Array<{ id: string; name: string; target_amount: number; current_amount: number; currency: string }>;
      result?: unknown;
      error?: string;
    }
  | {
      kind: 'convert';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      from: string;
      to: string;
      amount: number;
      result?: ConversionResult;
      error?: string;
    }
  | {
      kind: 'rate';
      status: 'loading' | 'ready' | 'error' | 'done';
      original: string;
      from: string;
      to: string;
      result?: ConversionResult;
      error?: string;
    };

export interface ChatContextValue {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  conversations: Array<{ id: string; title: string; created_at: string; updated_at: string }>;
  isTyping: boolean;
  streamingDraft: string;
  liveTrace: ChatStreamTraceEvent[];
  traceByMessageID: Record<string, ChatStreamTraceEvent[]>;
  pendingAction: PendingAction | null;
  setPendingAction: (action: PendingAction | null) => void;
  sendError: string | null;
  handleSendMessage: (message: string, attachment?: File) => void;
  handleNewConversation: () => void;
  handleDeleteConversation: (id: string) => void;
}
