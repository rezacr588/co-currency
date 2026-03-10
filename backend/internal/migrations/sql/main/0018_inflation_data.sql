-- inflation_rates: historical CPI/inflation per country, monthly granularity
CREATE TABLE IF NOT EXISTS inflation_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(3) NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    annual_rate DECIMAL(10, 4) NOT NULL,
    monthly_rate DECIMAL(10, 6),
    cpi_index DECIMAL(20, 8),
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(country_code, year, month)
);
CREATE INDEX IF NOT EXISTS idx_inflation_rates_currency ON inflation_rates(currency_code, year DESC, month DESC);

-- inflation_latest: fast lookup table for current rates per currency
CREATE TABLE IF NOT EXISTS inflation_latest (
    currency_code VARCHAR(10) PRIMARY KEY,
    country_code VARCHAR(3) NOT NULL,
    annual_rate DECIMAL(10, 4) NOT NULL,
    monthly_rate DECIMAL(10, 6),
    source VARCHAR(50) NOT NULL,
    data_date DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- wealth_alerts: user-facing alerts for currency/inflation events
CREATE TABLE IF NOT EXISTS wealth_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    currency_code VARCHAR(10),
    threshold_value DECIMAL(10, 4),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wealth_alerts_user_unread ON wealth_alerts(user_id, is_read, created_at DESC);

-- Add wealth_alerts preference to notification_preferences
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS wealth_alerts BOOLEAN DEFAULT TRUE;
