-- Additional performance indexes for common query patterns.

-- Wallet balances: lookups by user and currency
CREATE INDEX IF NOT EXISTS idx_wallet_balances_user_currency
    ON wallet_balances(user_id, UPPER(TRIM(currency)));

-- Recurring transactions: active items with next_execution for scheduling
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_active_next
    ON recurring_transactions(user_id, is_active, next_execution DESC)
    WHERE is_active = TRUE;

-- Budgets: user + category lookups for spent calculation
CREATE INDEX IF NOT EXISTS idx_budgets_user_category
    ON budgets(user_id, category);

-- Goals: user + status for filtered lists
CREATE INDEX IF NOT EXISTS idx_goals_user_status
    ON goals(user_id, workflow_status);

-- Categories: separate index for default categories (avoid OR in query)
CREATE INDEX IF NOT EXISTS idx_categories_user_id
    ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_default
    ON categories(is_default) WHERE is_default = TRUE;

-- Transaction tags: common join pattern
CREATE INDEX IF NOT EXISTS idx_transaction_tags_transaction_id
    ON transaction_tags(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag_id
    ON transaction_tags(tag_id);

-- Subscriptions: user + active status for upcoming bills
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active_next
    ON subscriptions(user_id, is_active, next_billing_date)
    WHERE is_active = TRUE;

-- Loans: user + active status for payment tracking
CREATE INDEX IF NOT EXISTS idx_loans_user_active
    ON loans(user_id, is_active)
    WHERE is_active = TRUE;
