-- Social Finance: Shared Spaces & Collaborative Budgets
-- Migration: 0023_social_finance_tables.sql

-- Shared Spaces (groups for collaborative finance)
CREATE TABLE IF NOT EXISTS shared_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'custom',
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    icon_emoji VARCHAR(10),
    settings JSONB NOT NULL DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_space_type CHECK (type IN ('couple', 'family', 'roommates', 'trip', 'project', 'custom'))
);

CREATE INDEX idx_shared_spaces_created_by ON shared_spaces(created_by);

-- Space Members
CREATE TABLE IF NOT EXISTS space_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES shared_spaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    nickname VARCHAR(50),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT valid_member_role CHECK (role IN ('owner', 'admin', 'member')),
    UNIQUE(space_id, user_id)
);

CREATE INDEX idx_space_members_space_id ON space_members(space_id);
CREATE INDEX idx_space_members_user_id ON space_members(user_id);

-- Space Invitations
CREATE TABLE IF NOT EXISTS space_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES shared_spaces(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    code VARCHAR(32) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_invite_role CHECK (role IN ('admin', 'member'))
);

CREATE INDEX idx_space_invites_space_id ON space_invites(space_id);
CREATE INDEX idx_space_invites_invitee_email ON space_invites(invitee_email);
CREATE INDEX idx_space_invites_code ON space_invites(code);

-- Shared Expenses
CREATE TABLE IF NOT EXISTS shared_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES shared_spaces(id) ON DELETE CASCADE,
    paid_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    split_method VARCHAR(20) NOT NULL DEFAULT 'equal',
    receipt_url TEXT,
    notes TEXT,
    expense_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT positive_expense_amount CHECK (amount > 0),
    CONSTRAINT valid_split_method CHECK (split_method IN ('equal', 'percentage', 'shares', 'exact'))
);

CREATE INDEX idx_shared_expenses_space_id ON shared_expenses(space_id);
CREATE INDEX idx_shared_expenses_paid_by ON shared_expenses(paid_by_user_id);
CREATE INDEX idx_shared_expenses_date ON shared_expenses(expense_date);

-- Expense Splits (how expense is divided among members)
CREATE TABLE IF NOT EXISTS expense_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES shared_expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(20, 8) NOT NULL,
    percentage DECIMAL(5, 2),
    shares INTEGER,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT positive_split_amount CHECK (amount >= 0),
    UNIQUE(expense_id, user_id)
);

CREATE INDEX idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user_id ON expense_splits(user_id);

-- Settlements (payments between members)
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES shared_spaces(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    method VARCHAR(50),
    notes TEXT,
    settled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT positive_settlement_amount CHECK (amount > 0),
    CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

CREATE INDEX idx_settlements_space_id ON settlements(space_id);
CREATE INDEX idx_settlements_from_user ON settlements(from_user_id);
CREATE INDEX idx_settlements_to_user ON settlements(to_user_id);

-- Shared Budgets
CREATE TABLE IF NOT EXISTS shared_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES shared_spaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    period VARCHAR(20) NOT NULL DEFAULT 'monthly',
    start_date DATE NOT NULL,
    end_date DATE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT positive_budget_amount CHECK (amount > 0),
    CONSTRAINT valid_budget_period CHECK (period IN ('weekly', 'monthly', 'yearly'))
);

CREATE INDEX idx_shared_budgets_space_id ON shared_budgets(space_id);

-- Space Activity Feed
CREATE TABLE IF NOT EXISTS space_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES shared_spaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    ref_id UUID,
    message TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_space_activities_space_id ON space_activities(space_id);
CREATE INDEX idx_space_activities_created_at ON space_activities(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_social_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_shared_spaces_updated_at
    BEFORE UPDATE ON shared_spaces
    FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

CREATE TRIGGER trigger_shared_expenses_updated_at
    BEFORE UPDATE ON shared_expenses
    FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

CREATE TRIGGER trigger_shared_budgets_updated_at
    BEFORE UPDATE ON shared_budgets
    FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();
