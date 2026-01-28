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

type StreamHandlers = {
  onStart?: (conversationId: string) => void;
  onDelta?: (chunk: string) => void;
  onDone?: (response: ChatResponse) => void;
  onError?: (error: string) => void;
};

type StreamPayload = {
  type: 'start' | 'delta' | 'done' | 'error';
  conversation_id?: string;
  content?: string;
  message?: ChatMessage;
  error?: string;
};

type StreamState = {
  buffer: string;
  finalResponse: ChatResponse | null;
};

const processSseChunk = (
  chunk: string,
  handlers: StreamHandlers,
  state: StreamState
) => {
  state.buffer += chunk.replace(/\r/g, '');

  const events = state.buffer.split('\n\n');
  state.buffer = events.pop() ?? '';

  for (const event of events) {
    const dataLines = event
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s?/, ''))
      .join('\n')
      .trim();

    if (!dataLines) continue;

    let payload: StreamPayload | null = null;

    try {
      payload = JSON.parse(dataLines);
    } catch {
      continue;
    }

    if (payload.type === 'start' && payload.conversation_id) {
      handlers.onStart?.(payload.conversation_id);
    }

    if (payload.type === 'delta' && payload.content) {
      handlers.onDelta?.(payload.content);
    }

    if (payload.type === 'done' && payload.message && payload.conversation_id) {
      state.finalResponse = {
        conversation_id: payload.conversation_id,
        message: payload.message,
      };
      handlers.onDone?.(state.finalResponse);
    }

    if (payload.type === 'error') {
      const message = payload.error || 'Streaming error';
      handlers.onError?.(message);
      throw new Error(message);
    }
  }
};

const streamViaFetch = async (
  data: ChatRequest,
  handlers: StreamHandlers
): Promise<ChatResponse> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE}/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
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
  const state: StreamState = { buffer: '', finalResponse: null };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    processSseChunk(decoder.decode(value, { stream: true }), handlers, state);
  }

  if (!state.finalResponse) {
    throw new Error('Stream ended without a response');
  }

  return state.finalResponse;
};

const streamViaXHR = (data: ChatRequest, handlers: StreamHandlers): Promise<ChatResponse> =>
  new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === 'undefined') {
      reject(new Error('Streaming not supported'));
      return;
    }

    const xhr = new XMLHttpRequest();
    const state: StreamState = { buffer: '', finalResponse: null };
    let lastIndex = 0;

    xhr.onreadystatechange = () => {
      if (xhr.readyState === xhr.HEADERS_RECEIVED && xhr.status >= 400) {
        reject(new Error(xhr.responseText || `Request failed with status ${xhr.status}`));
        xhr.abort();
      }
    };

    xhr.onprogress = () => {
      const responseText = xhr.responseText ?? '';
      if (responseText.length <= lastIndex) return;
      const chunk = responseText.slice(lastIndex);
      lastIndex = responseText.length;
      try {
        processSseChunk(chunk, handlers, state);
      } catch (error) {
        xhr.abort();
        reject(error instanceof Error ? error : new Error('Streaming error'));
      }
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(xhr.responseText || `Request failed with status ${xhr.status}`));
        return;
      }

      if (state.buffer) {
        try {
          processSseChunk('\n\n', handlers, state);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Streaming error'));
          return;
        }
      }

      if (!state.finalResponse) {
        reject(new Error('Stream ended without a response'));
        return;
      }

      resolve(state.finalResponse);
    };

    xhr.onerror = () => {
      reject(new Error('Network error'));
    };

    xhr.open('POST', `${API_BASE}/ai/chat/stream`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(JSON.stringify(data));
  });

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
    handlers: StreamHandlers = {}
  ): Promise<ChatResponse> => {
    try {
      return await streamViaFetch(data, handlers);
    } catch (error) {
      if (typeof XMLHttpRequest === 'undefined') {
        throw error;
      }
      return streamViaXHR(data, handlers);
    }
  },
};
