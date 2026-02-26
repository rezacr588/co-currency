-- Performance indexes for heavy read paths (reports + chat).

-- Transaction report scans commonly filter by user + created_at and optionally type/category.
CREATE INDEX IF NOT EXISTS idx_transactions_user_created_at_desc
	ON transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_type_created_at_desc
	ON transactions(user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_category_created_at_desc
	ON transactions(user_id, category, created_at DESC);

-- Conversation list uses user filter and updated_at ordering.
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated_at_desc
	ON chat_conversations(user_id, updated_at DESC);

-- Chat usage and message reads filter by conversation, role, and created_at.
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_role_created_at_desc
	ON chat_messages(conversation_id, role, created_at DESC);
