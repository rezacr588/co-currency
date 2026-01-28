import { API_BASE, fetchAPI, getAuthToken } from './base';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatRequest {
  conversation_id?: string;
  message: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: ChatMessage;
  tokens_used?: number;
}

export interface ConversationWithMessages {
  conversation: Conversation;
  messages: ChatMessage[];
}

export const chat = {
  listConversations: () =>
    fetchAPI<{ conversations: Conversation[] }>('/ai/conversations'),

  createConversation: (title?: string) =>
    fetchAPI<{ conversation_id: string }>('/ai/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  getConversation: (id: string) =>
    fetchAPI<ConversationWithMessages>(`/ai/conversations/${id}`),

  deleteConversation: (id: string) =>
    fetchAPI<{ message: string }>(`/ai/conversations/${id}`, {
      method: 'DELETE',
    }),

  sendMessage: (data: ChatRequest) =>
    fetchAPI<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  streamMessage: async (
    data: ChatRequest,
    handlers: {
      onStart?: (conversationId: string) => void;
      onDelta?: (chunk: string) => void;
      onDone?: (response: ChatResponse) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<ChatResponse> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `Request failed with status ${response.status}`);
    }

    const reader = response.body?.getReader?.();
    const decoderCtor =
      typeof TextDecoder !== 'undefined' ? TextDecoder : (globalThis as any).TextDecoder;
    if (!reader || !decoderCtor) {
      throw new Error('Streaming not supported');
    }

    const decoder = new decoderCtor();
    let buffer = '';
    let finalResponse: ChatResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const dataLines = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.replace(/^data:\s?/, ''))
          .join('\n')
          .trim();

        if (!dataLines) continue;

        let payload: {
          type: 'start' | 'delta' | 'done' | 'error';
          conversation_id?: string;
          content?: string;
          message?: ChatMessage;
          error?: string;
        } | null = null;

        try {
          payload = JSON.parse(dataLines);
        } catch {
          // Ignore malformed events.
          continue;
        }

        if (payload.type === 'start' && payload.conversation_id) {
          handlers.onStart?.(payload.conversation_id);
        }

        if (payload.type === 'delta' && payload.content) {
          handlers.onDelta?.(payload.content);
        }

        if (payload.type === 'done' && payload.message && payload.conversation_id) {
          finalResponse = {
            conversation_id: payload.conversation_id,
            message: payload.message,
          };
          handlers.onDone?.(finalResponse);
        }

        if (payload.type === 'error') {
          const message = payload.error || 'Streaming error';
          handlers.onError?.(message);
          throw new Error(message);
        }
      }
    }

    if (!finalResponse) {
      throw new Error('Stream ended without a response');
    }

    return finalResponse;
  },
};
