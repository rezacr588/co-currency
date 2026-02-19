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

export interface ChatAttachment {
  uri: string;
  mimeType: string;
  name: string;
  size?: number;
}

export interface ChatRequest {
  conversation_id?: string;
  message: string;
  file?: ChatAttachment;
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

  sendMessage: (data: ChatRequest) => {
    if (data.file) {
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
    }
    return fetchAPI<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: data.conversation_id, message: data.message }),
    });
  },
};
