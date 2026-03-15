-- CoAI preferences on the user profile plus assistant action metadata on chat messages.
ALTER TABLE users
	ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
	ADD COLUMN IF NOT EXISTS coai_focus_areas JSONB NOT NULL DEFAULT '["general"]'::jsonb,
	ADD COLUMN IF NOT EXISTS coai_weekly_brief_enabled BOOLEAN NOT NULL DEFAULT TRUE,
	ADD COLUMN IF NOT EXISTS coai_proactive_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE chat_messages
	ADD COLUMN IF NOT EXISTS recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb;
