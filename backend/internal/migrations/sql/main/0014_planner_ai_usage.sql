-- Planner board ordering, task finance/reminders/subtasks, task tags, goal workflow state,
-- and AI usage/cost metadata persistence.

-- Tasks enhancements for planner + finance coupling
ALTER TABLE tasks
	ADD COLUMN IF NOT EXISTS sort_order DOUBLE PRECISION NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS auto_ledger_enabled BOOLEAN NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS ledger_type VARCHAR(20),
	ADD COLUMN IF NOT EXISTS ledger_amount DECIMAL(20, 8),
	ADD COLUMN IF NOT EXISTS ledger_currency VARCHAR(3),
	ADD COLUMN IF NOT EXISTS ledger_wallet_currency VARCHAR(3),
	ADD COLUMN IF NOT EXISTS ledger_category VARCHAR(100),
	ADD COLUMN IF NOT EXISTS ledger_description TEXT,
	ADD COLUMN IF NOT EXISTS reminder_mode VARCHAR(20) NOT NULL DEFAULT 'off',
	ADD COLUMN IF NOT EXISTS reminder_next_at TIMESTAMP WITH TIME ZONE,
	ADD COLUMN IF NOT EXISTS subtasks JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_ledger_type_valid') THEN
		ALTER TABLE tasks
			ADD CONSTRAINT tasks_ledger_type_valid CHECK (
				ledger_type IS NULL OR ledger_type IN ('credit', 'debit')
			);
	END IF;
END $$;

DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_reminder_mode_valid') THEN
		ALTER TABLE tasks
			ADD CONSTRAINT tasks_reminder_mode_valid CHECK (reminder_mode IN ('off', 'aggressive'));
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(user_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_next_at ON tasks(reminder_next_at);

-- Shared tags linking tasks <-> tags
CREATE TABLE IF NOT EXISTS task_tags (
	task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
	tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	PRIMARY KEY (task_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

-- Goal workflow columns for planner board
ALTER TABLE goals
	ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(20) NOT NULL DEFAULT 'todo',
	ADD COLUMN IF NOT EXISTS sort_order DOUBLE PRECISION NOT NULL DEFAULT 0;

DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_workflow_status_valid') THEN
		ALTER TABLE goals
			ADD CONSTRAINT goals_workflow_status_valid CHECK (workflow_status IN ('todo', 'in_progress', 'done', 'archived'));
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_goals_workflow_sort ON goals(user_id, workflow_status, sort_order);

-- Chat usage/cost telemetry metadata
ALTER TABLE chat_messages
	ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
	ADD COLUMN IF NOT EXISTS model VARCHAR(120),
	ADD COLUMN IF NOT EXISTS thinking_mode VARCHAR(20),
	ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS completion_tokens INTEGER NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS total_tokens INTEGER NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS estimated_cost_usd DECIMAL(20, 8),
	ADD COLUMN IF NOT EXISTS billed_cost_usd DECIMAL(20, 8),
	ADD COLUMN IF NOT EXISTS billing_source VARCHAR(20) NOT NULL DEFAULT 'estimated';

DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_billing_source_valid') THEN
		ALTER TABLE chat_messages
			ADD CONSTRAINT chat_messages_billing_source_valid CHECK (billing_source IN ('exact', 'estimated', 'hybrid'));
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_usage_user_time
	ON chat_messages(conversation_id, created_at DESC);
