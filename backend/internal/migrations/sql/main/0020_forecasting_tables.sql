-- Migration: 0020_forecasting_tables
-- Description: Add tables for ML-based cash flow forecasting and anomaly detection
-- Created: 2026-03-20

-- Forecasts table: stores generated forecast data for historical analysis
CREATE TABLE IF NOT EXISTS forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    forecast_date DATE NOT NULL,
    days_ahead INTEGER NOT NULL,
    predictions JSONB NOT NULL,
    confidence_score DECIMAL(5,4),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, currency, forecast_date, days_ahead)
);

-- Anomalies table: stores detected spending anomalies for audit trail
CREATE TABLE IF NOT EXISTS anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    transaction_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    expected_min DECIMAL(20,8),
    expected_max DECIMAL(20,8),
    z_score DECIMAL(10,4),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_forecasts_user_id ON forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_user_currency_date ON forecasts(user_id, currency, forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_user_id ON anomalies(user_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_user_detected ON anomalies(user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_user_unacknowledged ON anomalies(user_id, acknowledged) WHERE acknowledged = FALSE;
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
