import { API_BASE, fetchAPI, getAuthToken, loadTokens } from './base';
import { Platform } from 'react-native';
import type { RecommendedAction } from './coai';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  recommended_actions?: RecommendedAction[];
  tools_used?: Array<{
    name: string;
    count: number;
  }>;
  tokens_used?: number;
  provider?: string;
  model?: string;
  thinking_mode?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
  billed_cost_usd?: number;
  billing_source?: 'exact' | 'estimated' | 'hybrid' | string;
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
  thinking_mode?: 'auto' | 'fast' | 'thinking';
}

export interface ChatAttachmentRequest extends ChatRequestBase {
  file: ChatAttachment;
}

export interface ChatResponse {
  conversation_id: string;
  message: ChatMessage;
  recommended_actions?: RecommendedAction[];
  tokens_used?: number;
  provider?: string;
  model?: string;
  thinking_mode?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  estimated_cost_usd?: number;
  billed_cost_usd?: number;
  billing_source?: 'exact' | 'estimated' | 'hybrid' | string;
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
  stage?: string;
  sequence_id?: number;
  timestamp?: string;
  trace_id?: string;
  conversation_id?: string;
  user_id?: string;
  raw?: Record<string, unknown>;
  tool_name?: string;
  tool_args?: unknown;
  duration_ms?: number;
  result_size?: number;
  error?: string;
  [key: string]: unknown;
}

export interface ChatStreamDoneEvent {
  type: 'done';
  conversation_id: string;
  message: ChatMessage;
  recommended_actions?: RecommendedAction[];
  provider?: string;
  model?: string;
  thinking_mode?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  estimated_cost_usd?: number;
  billed_cost_usd?: number;
  billing_source?: 'exact' | 'estimated' | 'hybrid' | string;
  trace_id?: string;
}

export interface ChatStreamHeartbeatEvent {
  type: 'heartbeat';
  timestamp?: string;
  trace_id?: string;
}

export interface ChatStreamCallbacks {
  onStart?: (event: ChatStreamStartEvent) => void;
  onDelta?: (event: ChatStreamDeltaEvent) => void;
  onTrace?: (event: ChatStreamTraceEvent) => void;
  onDone?: (event: ChatStreamDoneEvent) => void;
  onHeartbeat?: (event: ChatStreamHeartbeatEvent) => void;
}

type StreamPayload = Record<string, unknown>;

type StreamPayloadResult =
  | { kind: 'none' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; response: ChatResponse };

export function parseSSEPayload(rawEvent: string): StreamPayload | null {
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

export function handleChatStreamPayload(
  payload: StreamPayload,
  callbacks: ChatStreamCallbacks
): StreamPayloadResult {
  const type = typeof payload.type === 'string' ? payload.type : '';
  if (type === 'start') {
    callbacks.onStart?.(payload as unknown as ChatStreamStartEvent);
    return { kind: 'none' };
  }
  if (type === 'delta') {
    const content = typeof payload.content === 'string' ? payload.content : '';
    if (content) {
      callbacks.onDelta?.({ type: 'delta', content });
    }
    return { kind: 'none' };
  }
  if (type === 'trace') {
    callbacks.onTrace?.(payload as unknown as ChatStreamTraceEvent);
    return { kind: 'none' };
  }
  if (type === 'heartbeat') {
    callbacks.onHeartbeat?.(payload as unknown as ChatStreamHeartbeatEvent);
    return { kind: 'none' };
  }
  if (type === 'error') {
    const message = typeof payload.error === 'string' ? payload.error : 'Streaming request failed';
    return { kind: 'error', message };
  }
  if (type === 'done') {
    const doneEvent = payload as unknown as ChatStreamDoneEvent;
    callbacks.onDone?.(doneEvent);
    return { kind: 'done', response: normalizeDoneResponse(doneEvent) };
  }
  return { kind: 'none' };
}

export interface ConversationWithMessages {
  conversation: Conversation;
  messages: ChatMessage[];
}

export interface ChatUsageSummary {
  days: number;
  currency: string;
  totals: {
    messages: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
    billed_cost_usd: number;
  };
  daily: Array<{
    day: string;
    messages: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
    billed_cost_usd: number;
  }>;
  by_model: Array<{
    provider: string;
    model: string;
    messages: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
    billed_cost_usd: number;
    billing_source: 'exact' | 'estimated' | 'hybrid' | string;
  }>;
  by_tool: Array<{
    name: string;
    calls: number;
    messages: number;
  }>;
}

function normalizeDoneResponse(doneEvent: ChatStreamDoneEvent): ChatResponse {
  return {
    conversation_id: doneEvent.conversation_id,
    message: doneEvent.message,
    recommended_actions: doneEvent.recommended_actions,
    provider: doneEvent.provider,
    model: doneEvent.model,
    thinking_mode: doneEvent.thinking_mode,
    usage: doneEvent.usage,
    estimated_cost_usd: doneEvent.estimated_cost_usd,
    billed_cost_usd: doneEvent.billed_cost_usd,
    billing_source: doneEvent.billing_source,
    trace_id: doneEvent.trace_id,
  };
}

function shouldUseWebSocketFirst(): boolean {
  return Platform.OS !== 'web';
}

function buildRealtimeWSURL(withTrace: boolean): string {
  const base = API_BASE.replace(/^http/i, 'ws');
  return withTrace ? `${base}/ai/chat/realtime?trace=1` : `${base}/ai/chat/realtime`;
}

async function sendMessageStreamViaWebSocket(
  data: ChatRequestBase,
  callbacks: ChatStreamCallbacks,
  token: string | null
): Promise<ChatResponse> {
  if (!token) {
    throw new Error('Missing auth token for realtime stream');
  }

  return new Promise<ChatResponse>((resolve, reject) => {
    const wsURL = buildRealtimeWSURL(Boolean(callbacks.onTrace));
    const socket = new (WebSocket as any)(wsURL, undefined, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }) as WebSocket;

    let settled = false;
    let seenDone = false;
    let finalResponse: ChatResponse | null = null;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    let handshakeTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      if (handshakeTimer) {
        clearTimeout(handshakeTimer);
      }
    };

    const armInactivityTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      inactivityTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.close();
          reject(new Error('Realtime stream stalled'));
        }
      }, 20000);
    };

    const settleSuccess = (response: ChatResponse) => {
      if (settled) return;
      settled = true;
      clearTimers();
      socket.close();
      resolve(response);
    };

    const settleError = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimers();
      socket.close();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    handshakeTimer = setTimeout(() => {
      settleError(new Error('Realtime connection timeout'));
    }, 12000);

    socket.onopen = () => {
      armInactivityTimer();
      socket.send(
        JSON.stringify({
          conversation_id: data.conversation_id,
          message: data.message,
          thinking_mode: data.thinking_mode,
        })
      );
    };

    socket.onmessage = (event) => {
      armInactivityTimer();
      if (typeof event.data !== 'string') return;

      let payload: StreamPayload;
      try {
        payload = JSON.parse(event.data) as StreamPayload;
      } catch {
        return;
      }

      const result = handleChatStreamPayload(payload, callbacks);
      if (result.kind === 'error') {
        settleError(new Error(result.message || 'Realtime stream failed'));
        return;
      }
      if (result.kind === 'done') {
        seenDone = true;
        finalResponse = result.response;
        settleSuccess(result.response);
      }
    };

    socket.onerror = () => {
      settleError(new Error('Network error while streaming realtime message'));
    };

    socket.onclose = () => {
      if (settled) {
        return;
      }
      if (seenDone && finalResponse) {
        settleSuccess(finalResponse);
        return;
      }
      settleError(new Error('Realtime stream closed before completion'));
    };
  });
}

async function sendMessageStreamViaSSE(
  data: ChatRequestBase,
  callbacks: ChatStreamCallbacks,
  token: string | null
): Promise<ChatResponse> {
  return new Promise<ChatResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let seenDone = false;
    let lastProcessedIndex = 0;
    let pendingBuffer = '';
    let streamError: string | null = null;
    let finalResponse: ChatResponse | null = null;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

    const armInactivityTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      inactivityTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        xhr.abort();
        reject(new Error('Streaming request stalled'));
      }, 20000);
    };

    const settleWithError = (error: unknown) => {
      if (settled) return;
      settled = true;
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const settleWithSuccess = (response: ChatResponse) => {
      if (settled) return;
      settled = true;
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      resolve(response);
    };

    const handlePayload = (payload: StreamPayload) => {
      const result = handleChatStreamPayload(payload, callbacks);
      if (result.kind === 'error') {
        streamError = result.message;
        return;
      }
      if (result.kind === 'done') {
        seenDone = true;
        finalResponse = result.response;
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
    armInactivityTimer();

    xhr.onprogress = () => {
      armInactivityTimer();
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

    xhr.send(
      JSON.stringify({
        conversation_id: data.conversation_id,
        message: data.message,
        thinking_mode: data.thinking_mode,
      })
    );
  });
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

  getUsageSummary: (days = 7) =>
    fetchAPI<ChatUsageSummary>(`/ai/usage/summary?days=${days}`),

  deleteConversation: (id: string) =>
    fetchAPI<{ message: string }>(`/ai/conversations/${id}`, {
      method: 'DELETE',
    }),

  updateConversationTitle: (id: string, title: string) =>
    fetchAPI<{ conversation: Conversation }>(`/ai/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),

  sendMessageWithAttachment: (data: ChatAttachmentRequest) => {
    const formData = new FormData();
    formData.append('message', data.message);
    if (data.conversation_id) formData.append('conversation_id', data.conversation_id);
    if (data.thinking_mode) formData.append('thinking_mode', data.thinking_mode);
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
    const prefersRealtimeWS = shouldUseWebSocketFirst();

    if (prefersRealtimeWS) {
      try {
        return await sendMessageStreamViaWebSocket(data, callbacks, token);
      } catch {
        return sendMessageStreamViaSSE(data, callbacks, token);
      }
    }

    return sendMessageStreamViaSSE(data, callbacks, token);
  },
};
