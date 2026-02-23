-- Add support for non-financial goals and task management

-- Goals: add flexible fields
ALTER TABLE goals ADD COLUMN IF NOT EXISTS goal_type VARCHAR(20) NOT NULL DEFAULT 'financial';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS description TEXT;

-- Non-financial goals do not always have a currency
ALTER TABLE goals ALTER COLUMN currency DROP NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_goal_type_valid') THEN
        ALTER TABLE goals ADD CONSTRAINT goals_goal_type_valid
            CHECK (goal_type IN ('financial', 'personal', 'health', 'learning', 'career', 'habit', 'project', 'other'));
    END IF;
END $$;

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'todo',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_valid') THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_status_valid
            CHECK (status IN ('todo', 'in_progress', 'done', 'archived'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_valid') THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_priority_valid
            CHECK (priority IN ('low', 'medium', 'high'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_title_non_empty') THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_title_non_empty
            CHECK (length(trim(title)) > 0);
    END IF;
END $$;
