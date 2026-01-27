import { fetchAPI } from './base';

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
};
