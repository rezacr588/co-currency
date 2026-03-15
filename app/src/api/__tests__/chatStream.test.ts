import { handleChatStreamPayload, parseSSEPayload } from '../chat';

describe('chat stream helpers', () => {
  it('parses SSE payload with multiple data lines', () => {
    const raw = [
      'event: message',
      'data: {"type":"delta",',
      'data: "content":"hello"}',
      '',
    ].join('\n');

    expect(parseSSEPayload(raw)).toEqual({ type: 'delta', content: 'hello' });
  });

  it('returns null for invalid SSE payload', () => {
    expect(parseSSEPayload('event: ping\n\n')).toBeNull();
    expect(parseSSEPayload('data: {not-json}\n\n')).toBeNull();
  });

  it('routes start/trace/heartbeat events to callbacks', () => {
    const callbacks = {
      onStart: jest.fn(),
      onTrace: jest.fn(),
      onHeartbeat: jest.fn(),
    };

    expect(handleChatStreamPayload({ type: 'start', conversation_id: 'c1' }, callbacks).kind).toBe('none');
    expect(handleChatStreamPayload({ type: 'trace', stage: 'llm' }, callbacks).kind).toBe('none');
    expect(handleChatStreamPayload({ type: 'heartbeat' }, callbacks).kind).toBe('none');

    expect(callbacks.onStart).toHaveBeenCalledTimes(1);
    expect(callbacks.onTrace).toHaveBeenCalledTimes(1);
    expect(callbacks.onHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('ignores empty delta and forwards non-empty delta', () => {
    const callbacks = {
      onDelta: jest.fn(),
    };

    expect(handleChatStreamPayload({ type: 'delta', content: '' }, callbacks).kind).toBe('none');
    expect(callbacks.onDelta).toHaveBeenCalledTimes(0);

    expect(handleChatStreamPayload({ type: 'delta', content: 'hi' }, callbacks).kind).toBe('none');
    expect(callbacks.onDelta).toHaveBeenCalledWith({ type: 'delta', content: 'hi' });
  });

  it('ignores delta payloads with non-string content', () => {
    const callbacks = {
      onDelta: jest.fn(),
    };

    expect(handleChatStreamPayload({ type: 'delta', content: 123 }, callbacks).kind).toBe('none');
    expect(callbacks.onDelta).not.toHaveBeenCalled();
  });

  it('returns normalized error result for error payloads', () => {
    expect(handleChatStreamPayload({ type: 'error', error: 'boom' }, {})).toEqual({
      kind: 'error',
      message: 'boom',
    });

    expect(handleChatStreamPayload({ type: 'error' }, {})).toEqual({
      kind: 'error',
      message: 'Streaming request failed',
    });
  });

  it('returns done response and calls onDone for done payloads', () => {
    const callbacks = {
      onDone: jest.fn(),
    };

    const payload = {
      type: 'done',
      conversation_id: 'conv-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      message: {
        id: 'm1',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Hello',
        recommended_actions: [
          {
            id: 'log-transaction',
            type: 'log_transaction',
            title: 'Log a transaction',
            description: 'Capture your next expense.',
            cta_label: 'Add transaction',
            target_route: '/transaction-create',
            requires_confirmation: true,
          },
        ],
        tools_used: [{ name: 'web_search', count: 1 }],
        created_at: '2026-01-01T00:00:00.000Z',
      },
      usage: {
        prompt_tokens: 10,
        completion_tokens: 4,
        total_tokens: 14,
      },
      estimated_cost_usd: 0.001,
      billing_source: 'estimated',
      trace_id: 'trace-1',
    };

    const result = handleChatStreamPayload(payload, callbacks);

    expect(result.kind).toBe('done');
    if (result.kind === 'done') {
      expect(result.response).toEqual({
        conversation_id: 'conv-1',
        provider: 'openai',
        model: 'gpt-4o-mini',
        message: payload.message,
        recommended_actions: undefined,
        usage: payload.usage,
        estimated_cost_usd: 0.001,
        billed_cost_usd: undefined,
        billing_source: 'estimated',
        thinking_mode: undefined,
        trace_id: 'trace-1',
      });
      expect(result.response.message.tools_used).toEqual([{ name: 'web_search', count: 1 }]);
      expect(result.response.message.recommended_actions?.[0].type).toBe('log_transaction');
    }

    expect(callbacks.onDone).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown payload types', () => {
    const callbacks = {
      onStart: jest.fn(),
      onDelta: jest.fn(),
      onTrace: jest.fn(),
      onDone: jest.fn(),
      onHeartbeat: jest.fn(),
    };

    const result = handleChatStreamPayload({ type: 'noop' }, callbacks);

    expect(result).toEqual({ kind: 'none' });
    expect(callbacks.onStart).not.toHaveBeenCalled();
    expect(callbacks.onDelta).not.toHaveBeenCalled();
    expect(callbacks.onTrace).not.toHaveBeenCalled();
    expect(callbacks.onDone).not.toHaveBeenCalled();
    expect(callbacks.onHeartbeat).not.toHaveBeenCalled();
  });
});
