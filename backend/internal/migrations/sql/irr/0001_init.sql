-- IRR rates schema

CREATE TABLE IF NOT EXISTS irr_rates (
    id SERIAL PRIMARY KEY,
    currency VARCHAR(10) NOT NULL,
    rate DOUBLE PRECISION NOT NULL,
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_irr_rates_currency ON irr_rates(currency);
CREATE INDEX IF NOT EXISTS idx_irr_rates_fetched_at ON irr_rates(fetched_at);

CREATE TABLE IF NOT EXISTS irr_latest_rates (
    currency VARCHAR(10) PRIMARY KEY,
    rate DOUBLE PRECISION NOT NULL,
    source VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
