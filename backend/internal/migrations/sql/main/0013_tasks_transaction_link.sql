-- Link tasks (todo items) to wallet transactions

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS transaction_id UUID;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_transaction_fk') THEN
        ALTER TABLE tasks
            ADD CONSTRAINT tasks_transaction_fk
            FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_transaction_id ON tasks(transaction_id);
