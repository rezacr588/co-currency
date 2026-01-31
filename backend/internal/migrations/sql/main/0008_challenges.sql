-- Challenges definition table
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('no_spend', 'save_amount', 'reduce_category', 'streak', 'limit_daily')),
    icon VARCHAR(50) NOT NULL DEFAULT 'trophy',
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
    duration_days INT NOT NULL DEFAULT 7,
    target_value DECIMAL(18, 4),
    target_category VARCHAR(100),
    target_percentage DECIMAL(5, 2),
    points_reward INT NOT NULL DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User challenge participation
CREATE TABLE IF NOT EXISTS user_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
    progress DECIMAL(5, 2) DEFAULT 0,
    current_value DECIMAL(18, 4) DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    streak_days INT DEFAULT 0,
    UNIQUE(user_id, challenge_id, started_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_challenges_type ON challenges(type);
CREATE INDEX IF NOT EXISTS idx_challenges_active ON challenges(is_active);
CREATE INDEX IF NOT EXISTS idx_challenges_featured ON challenges(is_featured);
CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON user_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_status ON user_challenges(status);
CREATE INDEX IF NOT EXISTS idx_user_challenges_challenge_id ON user_challenges(challenge_id);

-- Insert default challenges
INSERT INTO challenges (name, description, type, icon, difficulty, duration_days, target_value, points_reward, is_featured) VALUES
('No Spend Weekend', 'Go an entire weekend without spending any money', 'no_spend', 'ban', 'medium', 2, NULL, 150, true),
('Save $100 Challenge', 'Save at least $100 this week', 'save_amount', 'piggy-bank', 'medium', 7, 100, 200, true),
('Coffee-Free Week', 'Skip the coffee shop for a whole week', 'reduce_category', 'coffee', 'easy', 7, NULL, 100, false),
('Budget Master', 'Stay under budget for 7 consecutive days', 'streak', 'trophy', 'hard', 7, NULL, 300, true),
('Daily Limit $50', 'Keep daily spending under $50 for a week', 'limit_daily', 'wallet', 'medium', 7, 50, 200, false),
('Restaurant Detox', 'Reduce dining out spending by 50% this week', 'reduce_category', 'utensils', 'hard', 7, NULL, 250, false),
('Savings Sprint', 'Save $50 in just 3 days', 'save_amount', 'zap', 'hard', 3, 50, 150, false),
('No Impulse Buys', 'Avoid shopping category for 5 days', 'no_spend', 'shopping-bag', 'medium', 5, NULL, 175, false)
ON CONFLICT DO NOTHING;
