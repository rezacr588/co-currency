import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { API_BASE, getAuthToken, loadTokens } from '@/src/api';
import { api } from '@/src/api';

type RealtimeMessageType = 'agent_update' | 'social_update' | 'space_update' | string;

interface RealtimeEnvelope {
  type?: RealtimeMessageType;
  data?: unknown;
}

interface RealtimePayload {
  action?: string;
  space_id?: string;
  details?: Record<string, unknown>;
}

type NativeWebSocketCtor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> }
) => WebSocket;

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

// buildWebSocketURL produces the upgrade URL. `ticket` is only consumed on
// web (the native WebSocket API cannot set Authorization headers, so a
// short-lived single-use ticket rides on the query string instead of the
// full JWT). Native passes the JWT via header inside createSocket.
function buildWebSocketURL(ticket: string | null): string {
  const normalizedBase = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const ticketParam = ticket ? `?ticket=${encodeURIComponent(ticket)}` : '';

  if (normalizedBase.startsWith('/')) {
    if (typeof window === 'undefined') {
      return `${normalizedBase}/ws/`;
    }
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const origin = `${wsProtocol}://${window.location.host}`;
    return `${origin}${normalizedBase}/ws/${ticketParam}`;
  }

  const wsBase = normalizedBase.replace(/^http/i, 'ws');
  if (Platform.OS === 'web') {
    return `${wsBase}/ws/${ticketParam}`;
  }
  return `${wsBase}/ws/`;
}

function createSocket(url: string, token: string | null): WebSocket {
  if (Platform.OS === 'web') {
    return new WebSocket(url);
  }

  const NativeWebSocket = WebSocket as unknown as NativeWebSocketCtor;
  return new NativeWebSocket(url, undefined, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

function getPayload(data: unknown): RealtimePayload {
  if (!data || typeof data !== 'object') {
    return {};
  }
  return data as RealtimePayload;
}

function extractSpaceID(payload: RealtimePayload): string | null {
  if (typeof payload.space_id === 'string' && payload.space_id) {
    return payload.space_id;
  }

  const details = payload.details;
  if (details && typeof details.space_id === 'string' && details.space_id) {
    return details.space_id;
  }

  return null;
}

function invalidateAgentQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['agent'] });
}

function invalidateSocialQueries(queryClient: QueryClient, spaceID?: string | null) {
  queryClient.invalidateQueries({ queryKey: ['shared-spaces'] });
  queryClient.invalidateQueries({ queryKey: ['space-invites'] });

  if (!spaceID) {
    queryClient.invalidateQueries({ queryKey: ['space'] });
    queryClient.invalidateQueries({ queryKey: ['space-expenses'] });
    queryClient.invalidateQueries({ queryKey: ['space-balances'] });
    queryClient.invalidateQueries({ queryKey: ['space-members'] });
    queryClient.invalidateQueries({ queryKey: ['space-suggested'] });
    queryClient.invalidateQueries({ queryKey: ['space-activities'] });
    queryClient.invalidateQueries({ queryKey: ['space-settlements'] });
    queryClient.invalidateQueries({ queryKey: ['space-budgets'] });
    return;
  }

  queryClient.invalidateQueries({ queryKey: ['space', spaceID] });
  queryClient.invalidateQueries({ queryKey: ['space-expenses', spaceID] });
  queryClient.invalidateQueries({ queryKey: ['space-balances', spaceID] });
  queryClient.invalidateQueries({ queryKey: ['space-members', spaceID] });
  queryClient.invalidateQueries({ queryKey: ['space-suggested', spaceID] });
  queryClient.invalidateQueries({ queryKey: ['space-activities', spaceID] });
  queryClient.invalidateQueries({ queryKey: ['space-settlements', spaceID] });
  queryClient.invalidateQueries({ queryKey: ['space-budgets', spaceID] });
}

function handleRealtimeMessage(queryClient: QueryClient, rawData: unknown) {
  if (typeof rawData !== 'string') {
    return;
  }

  let envelope: RealtimeEnvelope;
  try {
    envelope = JSON.parse(rawData) as RealtimeEnvelope;
  } catch {
    return;
  }

  const msgType = envelope.type;
  const payload = getPayload(envelope.data);

  if (msgType === 'agent_update') {
    invalidateAgentQueries(queryClient);
    return;
  }

  if (msgType === 'social_update' || msgType === 'space_update') {
    const spaceID = extractSpaceID(payload);
    invalidateSocialQueries(queryClient, spaceID);
  }
}

export function useRealtimeSync(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    let isCancelled = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeSocket = () => {
      const socket = socketRef.current;
      if (!socket) {
        return;
      }
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      socketRef.current = null;
    };

    const scheduleReconnect = () => {
      if (isCancelled || !enabled) {
        return;
      }

      clearReconnectTimer();
      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current),
        MAX_RECONNECT_DELAY_MS
      );
      reconnectAttemptsRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        if (isCancelled || !enabled) {
          return;
        }
        void connect();
      }, delay);
    };

    const connect = async () => {
      try {
        await loadTokens();
        const token = getAuthToken();
        if (!token) {
          scheduleReconnect();
          return;
        }

        // Web: fetch a fresh single-use ticket (60s TTL) so the JWT never
        // appears in the WS upgrade URL / access logs. Native attaches the
        // JWT via Authorization header instead.
        let ticket: string | null = null;
        if (Platform.OS === 'web') {
          try {
            const response = await api.auth.requestWSTicket();
            ticket = response.ticket;
          } catch {
            scheduleReconnect();
            return;
          }
        }

        closeSocket();
        const socket = createSocket(
          buildWebSocketURL(ticket),
          Platform.OS === 'web' ? null : token,
        );
        socketRef.current = socket;

        socket.onopen = () => {
          reconnectAttemptsRef.current = 0;
        };

        socket.onmessage = (event) => {
          handleRealtimeMessage(queryClient, event.data);
        };

        socket.onerror = () => {
          // onclose will handle reconnect scheduling
        };

        socket.onclose = () => {
          socketRef.current = null;
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    };

    if (enabled) {
      void connect();
    } else {
      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      closeSocket();
    }

    return () => {
      isCancelled = true;
      clearReconnectTimer();
      closeSocket();
    };
  }, [enabled, queryClient]);
}

