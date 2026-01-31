-- Loans/Debts table for tracking money borrowed or lent
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('borrowed', 'lent')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    principal_amount DECIMAL(18, 4) NOT NULL CHECK (principal_amount > 0),
    remaining_amount DECIMAL(18, 4) NOT NULL CHECK (remaining_amount >= 0),
    currency VARCHAR(10) NOT NULL,
    interest_rate DECIMAL(5, 2) DEFAULT 0,
    counterparty VARCHAR(255),
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'defaulted', 'forgiven')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loan payments/repayments tracking
CREATE TABLE IF NOT EXISTS loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    amount DECIMAL(18, 4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('payment', 'interest', 'forgiveness')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_type ON loans(type);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);
