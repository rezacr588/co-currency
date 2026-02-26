-- Persist AI tool usage per assistant message for reliable UI history and analytics.
ALTER TABLE chat_messages
	ADD COLUMN IF NOT EXISTS tools_used JSONB NOT NULL DEFAULT '[]'::jsonb;

