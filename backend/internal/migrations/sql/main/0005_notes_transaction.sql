-- Add transaction_id to notes for linking notes to transactions

ALTER TABLE notes ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notes_transaction_id ON notes(transaction_id);
