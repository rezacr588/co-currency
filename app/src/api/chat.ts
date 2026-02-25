import { API_BASE, fetchAPI, getAuthToken, loadTokens } from './base';

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

export interface ChatAttachment {
  uri: string;
  mimeType: string;
  name: string;
  size?: number;
}

export interface ChatRequestBase {
  conversation_id?: string;
  message: string;
}

export interface ChatAttachmentRequest extends ChatRequestBase {
  file: ChatAttachment;
}

export interface ChatResponse {
  conversation_id: string;
  message: ChatMessage;
  tokens_used?: number;
  trace_id?: string;
}

export interface ChatStreamStartEvent {
  type: 'start';
  conversation_id: string;
  trace_id?: string;
}

export interface ChatStreamDeltaEvent {
  type: 'delta';
  content: string;
}

export interface ChatStreamTraceEvent {
  type: 'trace';
  step: string;
  trace_id?: string;
  conversation_id?: string;
  user_id?: string;
  [key: string]: unknown;
}

export interface ChatStreamDoneEvent {
  type: 'done';
  conversation_id: string;
  message: ChatMessage;
  trace_id?: string;
}

export interface ChatStreamCallbacks {
  onStart?: (event: ChatStreamStartEvent) => void;
  onDelta?: (event: ChatStreamDeltaEvent) => void;
  onTrace?: (event: ChatStreamTraceEvent) => void;
  onDone?: (event: ChatStreamDoneEvent) => void;
}

function parseSSEPayload(rawEvent: string): Record<string, unknown> | null {
  const dataLines = rawEvent
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
  } catch {
    return null;
  }
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

  sendMessageWithAttachment: (data: ChatAttachmentRequest) => {
    const formData = new FormData();
    formData.append('message', data.message);
    if (data.conversation_id) formData.append('conversation_id', data.conversation_id);
    formData.append('file', {
      uri: data.file.uri,
      type: data.file.mimeType,
      name: data.file.name,
    } as any);

    return fetchAPI<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: formData as any,
      isFormData: true,
    });
  },

  sendMessageStream: async (
    data: ChatRequestBase,
    callbacks: ChatStreamCallbacks = {}
  ): Promise<ChatResponse> => {
    await loadTokens();
    const token = getAuthToken();

    return new Promise<ChatResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let settled = false;
      let seenDone = false;
      let lastProcessedIndex = 0;
      let pendingBuffer = '';
      let streamError: string | null = null;
      let finalResponse: ChatResponse | null = null;

      const settleWithError = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const settleWithSuccess = (response: ChatResponse) => {
        if (settled) return;
        settled = true;
        resolve(response);
      };

      const handlePayload = (payload: Record<string, unknown>) => {
        const type = typeof payload.type === 'string' ? payload.type : '';
        if (type === 'start') {
          callbacks.onStart?.(payload as unknown as ChatStreamStartEvent);
          return;
        }
        if (type === 'delta') {
          const content = typeof payload.content === 'string' ? payload.content : '';
          if (content) {
            callbacks.onDelta?.({ type: 'delta', content });
          }
          return;
        }
        if (type === 'trace') {
          callbacks.onTrace?.(payload as unknown as ChatStreamTraceEvent);
          return;
        }
        if (type === 'error') {
          streamError = typeof payload.error === 'string' ? payload.error : 'Streaming request failed';
          return;
        }
        if (type === 'done') {
          const doneEvent = payload as unknown as ChatStreamDoneEvent;
          seenDone = true;
          finalResponse = {
            conversation_id: doneEvent.conversation_id,
            message: doneEvent.message,
            trace_id: doneEvent.trace_id,
          };
          callbacks.onDone?.(doneEvent);
        }
      };

      const processIncoming = (chunk: string) => {
        if (!chunk) return;
        pendingBuffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const events = pendingBuffer.split('\n\n');
        pendingBuffer = events.pop() ?? '';
        for (const rawEvent of events) {
          const payload = parseSSEPayload(rawEvent);
          if (!payload) continue;
          handlePayload(payload);
        }
      };

      const streamURL = callbacks.onTrace
        ? `${API_BASE}/ai/chat/stream?trace=1`
        : `${API_BASE}/ai/chat/stream`;
      xhr.open('POST', streamURL, true);
      xhr.responseType = 'text';
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.timeout = 90000;

      xhr.onprogress = () => {
        const responseText = xhr.responseText ?? '';
        if (responseText.length <= lastProcessedIndex) {
          return;
        }
        const chunk = responseText.slice(lastProcessedIndex);
        lastProcessedIndex = responseText.length;
        processIncoming(chunk);
      };

      xhr.onreadystatechange = () => {
        const responseText = xhr.responseText ?? '';
        if (responseText.length > lastProcessedIndex) {
          const chunk = responseText.slice(lastProcessedIndex);
          lastProcessedIndex = responseText.length;
          processIncoming(chunk);
        }

        if (xhr.readyState !== XMLHttpRequest.DONE) {
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          let message = `Request failed with status ${xhr.status}`;
          try {
            const parsed = JSON.parse(responseText) as { message?: string; error?: string; details?: string };
            message = parsed.message || parsed.error || parsed.details || message;
          } catch {
            if (responseText.trim()) {
              message = responseText.trim();
            }
          }
          settleWithError(new Error(message));
          return;
        }

        if (streamError) {
          settleWithError(new Error(streamError));
          return;
        }

        if (!seenDone || !finalResponse) {
          settleWithError(new Error('Stream ended before completion'));
          return;
        }

        settleWithSuccess(finalResponse);
      };

      xhr.onerror = () => {
        settleWithError(new Error('Network error while streaming message'));
      };

      xhr.ontimeout = () => {
        settleWithError(new Error('Streaming request timed out'));
      };

      xhr.send(JSON.stringify({
        conversation_id: data.conversation_id,
        message: data.message,
      }));
    });
  },
};
