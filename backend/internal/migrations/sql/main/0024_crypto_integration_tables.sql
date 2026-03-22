-- Crypto Integration Tables
-- Phase 4: Crypto wallets, balances, DeFi tracking, NFTs, and alerts

-- Crypto Wallets (connected or watch-only)
CREATE TABLE IF NOT EXISTS crypto_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    network VARCHAR(50) NOT NULL, -- ethereum, polygon, arbitrum, etc.
    label VARCHAR(100) DEFAULT '',
    is_watching BOOLEAN DEFAULT false, -- true = watch-only, false = connected
    last_synced TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, address, network)
);

CREATE INDEX idx_crypto_wallets_user ON crypto_wallets(user_id);
CREATE INDEX idx_crypto_wallets_address ON crypto_wallets(address);

-- Token Balances
CREATE TABLE IF NOT EXISTS crypto_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    token_address VARCHAR(255) NOT NULL, -- 'native' for ETH, MATIC, etc.
    token_symbol VARCHAR(20) NOT NULL,
    token_name VARCHAR(100) NOT NULL,
    token_type VARCHAR(20) NOT NULL DEFAULT 'erc20', -- native, erc20, erc721, spl
    token_decimals INTEGER NOT NULL DEFAULT 18,
    balance VARCHAR(100) NOT NULL DEFAULT '0', -- Raw balance (wei, etc.)
    balance_usd DECIMAL(20, 8) NOT NULL DEFAULT 0,
    price DECIMAL(20, 8) NOT NULL DEFAULT 0,
    price_change_24h DECIMAL(10, 4) DEFAULT 0,
    logo_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_id, token_address)
);

CREATE INDEX idx_crypto_balances_wallet ON crypto_balances(wallet_id);
CREATE INDEX idx_crypto_balances_symbol ON crypto_balances(token_symbol);

-- Blockchain Transactions
CREATE TABLE IF NOT EXISTS crypto_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    tx_hash VARCHAR(255) NOT NULL,
    network VARCHAR(50) NOT NULL,
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    token_address VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    amount VARCHAR(100) NOT NULL,
    amount_usd DECIMAL(20, 8) DEFAULT 0,
    gas_fee VARCHAR(50) DEFAULT '0',
    gas_fee_usd DECIMAL(20, 8) DEFAULT 0,
    tx_type VARCHAR(30) NOT NULL, -- send, receive, swap, approve, mint, burn
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed', -- pending, confirmed, failed
    block_number BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    linked_to_wallet BOOLEAN DEFAULT false, -- Linked to main fiat wallet
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_id, tx_hash)
);

CREATE INDEX idx_crypto_tx_wallet ON crypto_transactions(wallet_id);
CREATE INDEX idx_crypto_tx_hash ON crypto_transactions(tx_hash);
CREATE INDEX idx_crypto_tx_timestamp ON crypto_transactions(timestamp DESC);
CREATE INDEX idx_crypto_tx_type ON crypto_transactions(tx_type);

-- DeFi Positions
CREATE TABLE IF NOT EXISTS defi_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    protocol VARCHAR(50) NOT NULL, -- Aave, Uniswap, Compound, etc.
    protocol_type VARCHAR(30) NOT NULL, -- lending, swap, staking, liquidity, yield
    network VARCHAR(50) NOT NULL,
    position_type VARCHAR(30) NOT NULL, -- supply, borrow, lp, stake
    
    -- JSON fields for complex data
    supplied_tokens JSONB DEFAULT '[]',
    supplied_usd DECIMAL(20, 8) DEFAULT 0,
    borrowed_tokens JSONB DEFAULT '[]',
    borrowed_usd DECIMAL(20, 8) DEFAULT 0,
    lp_tokens JSONB DEFAULT '[]',
    pool_share DECIMAL(10, 8) DEFAULT 0,
    pending_rewards JSONB DEFAULT '[]',
    rewards_usd DECIMAL(20, 8) DEFAULT 0,
    
    -- Health metrics
    health_factor DECIMAL(10, 4),
    liquidation_risk VARCHAR(20), -- low, medium, high
    
    -- Yield metrics
    apy DECIMAL(10, 4) DEFAULT 0,
    apr DECIMAL(10, 4) DEFAULT 0,
    total_value_usd DECIMAL(20, 8) DEFAULT 0,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_id, protocol, network, position_type)
);

CREATE INDEX idx_defi_positions_wallet ON defi_positions(wallet_id);
CREATE INDEX idx_defi_positions_protocol ON defi_positions(protocol);

-- NFT Assets
CREATE TABLE IF NOT EXISTS nft_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    contract_address VARCHAR(255) NOT NULL,
    token_id VARCHAR(100) NOT NULL,
    network VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    collection_name VARCHAR(255),
    floor_price DECIMAL(20, 8) DEFAULT 0,
    last_sale_price DECIMAL(20, 8) DEFAULT 0,
    estimated_usd DECIMAL(20, 8) DEFAULT 0,
    attributes JSONB DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_id, contract_address, token_id, network)
);

CREATE INDEX idx_nft_assets_wallet ON nft_assets(wallet_id);
CREATE INDEX idx_nft_assets_collection ON nft_assets(collection_name);

-- Price Alerts
CREATE TABLE IF NOT EXISTS crypto_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL, -- price_above, price_below, health_factor, gas_price
    token_address VARCHAR(255),
    token_symbol VARCHAR(20),
    network VARCHAR(50),
    target_value DECIMAL(20, 8) NOT NULL,
    current_value DECIMAL(20, 8) DEFAULT 0,
    is_triggered BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_crypto_alerts_user ON crypto_alerts(user_id);
CREATE INDEX idx_crypto_alerts_active ON crypto_alerts(is_active, is_triggered);

-- Token Price Cache (for quick lookups)
CREATE TABLE IF NOT EXISTS token_prices (
    address VARCHAR(255) NOT NULL,
    network VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    change_24h DECIMAL(10, 4) DEFAULT 0,
    change_7d DECIMAL(10, 4) DEFAULT 0,
    market_cap DECIMAL(30, 2) DEFAULT 0,
    volume_24h DECIMAL(30, 2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY(address, network)
);

CREATE INDEX idx_token_prices_symbol ON token_prices(symbol);
CREATE INDEX idx_token_prices_updated ON token_prices(updated_at);
