-- Daily Login Rewards System
-- +goose Up

CREATE TABLE IF NOT EXISTS daily_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    login_date DATE NOT NULL,
    consecutive_days INTEGER DEFAULT 1,
    xp_awarded INTEGER NOT NULL,
    bonus_awarded BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure one reward per user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_rewards_user_date ON daily_rewards(user_id, login_date);
CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_id ON daily_rewards(user_id);

-- +goose Down
DROP TABLE IF EXISTS daily_rewards;
