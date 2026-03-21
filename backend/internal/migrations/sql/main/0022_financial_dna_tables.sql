-- Financial DNA and Behavioral Analytics Tables
-- Migration: 0022_financial_dna_tables.sql

-- Financial DNA profile (one per user)
CREATE TABLE IF NOT EXISTS financial_dna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    archetype VARCHAR(50) NOT NULL DEFAULT 'balanced_manager',
    
    -- Core dimensions (0-100 scale)
    spending_temperament DECIMAL(5,2) DEFAULT 50.0,
    planning_horizon DECIMAL(5,2) DEFAULT 50.0,
    risk_tolerance DECIMAL(5,2) DEFAULT 50.0,
    financial_stress DECIMAL(5,2) DEFAULT 50.0,
    impulse_control DECIMAL(5,2) DEFAULT 50.0,
    
    -- Computed arrays
    dimensions JSONB DEFAULT '[]'::jsonb,
    strengths JSONB DEFAULT '[]'::jsonb,
    growth_areas JSONB DEFAULT '[]'::jsonb,
    
    -- Analysis metadata
    transactions_analyzed INTEGER DEFAULT 0,
    analysis_period_days INTEGER DEFAULT 0,
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT financial_dna_user_unique UNIQUE (user_id)
);

-- Behavioral insights (many per user)
CREATE TABLE IF NOT EXISTS behavioral_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL, -- pattern, recommendation, alert
    category VARCHAR(30) NOT NULL, -- spending, timing, emotional, comparative
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    impact VARCHAR(20) NOT NULL DEFAULT 'neutral', -- positive, negative, neutral
    severity VARCHAR(20) NOT NULL DEFAULT 'low', -- low, medium, high
    data JSONB DEFAULT '{}'::jsonb,
    action_url VARCHAR(512),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- DNA quiz responses
CREATE TABLE IF NOT EXISTS dna_quiz_responses (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id VARCHAR(50) NOT NULL,
    answer INTEGER NOT NULL CHECK (answer >= 1 AND answer <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, question_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_behavioral_insights_user_unread 
    ON behavioral_insights(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_behavioral_insights_user_category 
    ON behavioral_insights(user_id, category);
CREATE INDEX IF NOT EXISTS idx_behavioral_insights_created 
    ON behavioral_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_dna_last_updated 
    ON financial_dna(last_updated DESC);
