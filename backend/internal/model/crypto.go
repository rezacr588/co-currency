package model

import (
	"time"

	"github.com/google/uuid"
)

// BlockchainNetwork represents supported blockchain networks
type BlockchainNetwork string

const (
	NetworkEthereum  BlockchainNetwork = "ethereum"
	NetworkPolygon   BlockchainNetwork = "polygon"
	NetworkArbitrum  BlockchainNetwork = "arbitrum"
	NetworkOptimism  BlockchainNetwork = "optimism"
	NetworkBase      BlockchainNetwork = "base"
	NetworkBSC       BlockchainNetwork = "bsc"
	NetworkAvalanche BlockchainNetwork = "avalanche"
	NetworkSolana    BlockchainNetwork = "solana"
)

// TokenType represents the type of crypto token
type TokenType string

const (
	TokenTypeNative TokenType = "native"   // ETH, MATIC, SOL, etc.
	TokenTypeERC20  TokenType = "erc20"    // ERC-20 tokens
	TokenTypeERC721 TokenType = "erc721"   // NFTs
	TokenTypeSPL    TokenType = "spl"      // Solana tokens
)

// DeFiProtocolType represents types of DeFi protocols
type DeFiProtocolType string

const (
	ProtocolTypeLending    DeFiProtocolType = "lending"
	ProtocolTypeSwap       DeFiProtocolType = "swap"
	ProtocolTypeStaking    DeFiProtocolType = "staking"
	ProtocolTypeLiquidity  DeFiProtocolType = "liquidity"
	ProtocolTypeYield      DeFiProtocolType = "yield"
	ProtocolTypeBridge     DeFiProtocolType = "bridge"
)

// CryptoWallet represents a user's connected crypto wallet
type CryptoWallet struct {
	ID          uuid.UUID         `json:"id" db:"id"`
	UserID      uuid.UUID         `json:"user_id" db:"user_id"`
	Address     string            `json:"address" db:"address"`
	Network     BlockchainNetwork `json:"network" db:"network"`
	Label       string            `json:"label" db:"label"`
	IsWatching  bool              `json:"is_watching" db:"is_watching"` // Watch-only vs connected
	LastSynced  *time.Time        `json:"last_synced,omitempty" db:"last_synced"`
	CreatedAt   time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at" db:"updated_at"`
}

// CryptoBalance represents a token balance in a wallet
type CryptoBalance struct {
	ID            uuid.UUID         `json:"id" db:"id"`
	WalletID      uuid.UUID         `json:"wallet_id" db:"wallet_id"`
	TokenAddress  string            `json:"token_address" db:"token_address"` // "native" for native tokens
	TokenSymbol   string            `json:"token_symbol" db:"token_symbol"`
	TokenName     string            `json:"token_name" db:"token_name"`
	TokenType     TokenType         `json:"token_type" db:"token_type"`
	TokenDecimals int               `json:"token_decimals" db:"token_decimals"`
	Balance       string            `json:"balance" db:"balance"` // Raw balance (wei, lamports, etc.)
	BalanceUSD    float64           `json:"balance_usd" db:"balance_usd"`
	Price         float64           `json:"price" db:"price"`
	PriceChange24h float64          `json:"price_change_24h" db:"price_change_24h"`
	LogoURL       string            `json:"logo_url,omitempty" db:"logo_url"`
	UpdatedAt     time.Time         `json:"updated_at" db:"updated_at"`
}

// CryptoTransaction represents a blockchain transaction
type CryptoTransaction struct {
	ID              uuid.UUID         `json:"id" db:"id"`
	WalletID        uuid.UUID         `json:"wallet_id" db:"wallet_id"`
	TxHash          string            `json:"tx_hash" db:"tx_hash"`
	Network         BlockchainNetwork `json:"network" db:"network"`
	FromAddress     string            `json:"from_address" db:"from_address"`
	ToAddress       string            `json:"to_address" db:"to_address"`
	TokenAddress    string            `json:"token_address" db:"token_address"`
	TokenSymbol     string            `json:"token_symbol" db:"token_symbol"`
	Amount          string            `json:"amount" db:"amount"`
	AmountUSD       float64           `json:"amount_usd" db:"amount_usd"`
	GasFee          string            `json:"gas_fee" db:"gas_fee"`
	GasFeeUSD       float64           `json:"gas_fee_usd" db:"gas_fee_usd"`
	TxType          string            `json:"tx_type" db:"tx_type"` // send, receive, swap, approve, etc.
	Status          string            `json:"status" db:"status"`   // pending, confirmed, failed
	BlockNumber     int64             `json:"block_number" db:"block_number"`
	Timestamp       time.Time         `json:"timestamp" db:"timestamp"`
	LinkedToWallet  bool              `json:"linked_to_wallet" db:"linked_to_wallet"` // Linked to main wallet
	CreatedAt       time.Time         `json:"created_at" db:"created_at"`
}

// DeFiPosition represents a user's position in a DeFi protocol
type DeFiPosition struct {
	ID              uuid.UUID        `json:"id" db:"id"`
	WalletID        uuid.UUID        `json:"wallet_id" db:"wallet_id"`
	Protocol        string           `json:"protocol" db:"protocol"`         // Aave, Uniswap, etc.
	ProtocolType    DeFiProtocolType `json:"protocol_type" db:"protocol_type"`
	Network         BlockchainNetwork `json:"network" db:"network"`
	PositionType    string           `json:"position_type" db:"position_type"` // supply, borrow, lp, stake
	
	// Supply/Deposit
	SuppliedTokens  []DeFiToken      `json:"supplied_tokens,omitempty"`
	SuppliedUSD     float64          `json:"supplied_usd" db:"supplied_usd"`
	
	// Borrow (for lending protocols)
	BorrowedTokens  []DeFiToken      `json:"borrowed_tokens,omitempty"`
	BorrowedUSD     float64          `json:"borrowed_usd" db:"borrowed_usd"`
	
	// LP Positions
	LPTokens        []DeFiToken      `json:"lp_tokens,omitempty"`
	PoolShare       float64          `json:"pool_share" db:"pool_share"`
	
	// Rewards
	PendingRewards  []DeFiToken      `json:"pending_rewards,omitempty"`
	RewardsUSD      float64          `json:"rewards_usd" db:"rewards_usd"`
	
	// Health/Risk
	HealthFactor    *float64         `json:"health_factor,omitempty" db:"health_factor"`
	LiquidationRisk string           `json:"liquidation_risk,omitempty" db:"liquidation_risk"` // low, medium, high
	
	APY             float64          `json:"apy" db:"apy"`
	APR             float64          `json:"apr" db:"apr"`
	TotalValueUSD   float64          `json:"total_value_usd" db:"total_value_usd"`
	
	UpdatedAt       time.Time        `json:"updated_at" db:"updated_at"`
}

// DeFiToken represents a token in a DeFi position
type DeFiToken struct {
	Address  string  `json:"address"`
	Symbol   string  `json:"symbol"`
	Amount   string  `json:"amount"`
	ValueUSD float64 `json:"value_usd"`
}

// CryptoAlert represents a price or position alert
type CryptoAlert struct {
	ID            uuid.UUID `json:"id" db:"id"`
	UserID        uuid.UUID `json:"user_id" db:"user_id"`
	AlertType     string    `json:"alert_type" db:"alert_type"` // price_above, price_below, health_factor, gas_price
	TokenAddress  string    `json:"token_address,omitempty" db:"token_address"`
	TokenSymbol   string    `json:"token_symbol,omitempty" db:"token_symbol"`
	Network       BlockchainNetwork `json:"network,omitempty" db:"network"`
	TargetValue   float64   `json:"target_value" db:"target_value"`
	CurrentValue  float64   `json:"current_value" db:"current_value"`
	IsTriggered   bool      `json:"is_triggered" db:"is_triggered"`
	IsActive      bool      `json:"is_active" db:"is_active"`
	TriggeredAt   *time.Time `json:"triggered_at,omitempty" db:"triggered_at"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// NFTAsset represents an NFT owned by a wallet
type NFTAsset struct {
	ID            uuid.UUID         `json:"id" db:"id"`
	WalletID      uuid.UUID         `json:"wallet_id" db:"wallet_id"`
	ContractAddr  string            `json:"contract_address" db:"contract_address"`
	TokenID       string            `json:"token_id" db:"token_id"`
	Network       BlockchainNetwork `json:"network" db:"network"`
	Name          string            `json:"name" db:"name"`
	Description   string            `json:"description,omitempty" db:"description"`
	ImageURL      string            `json:"image_url,omitempty" db:"image_url"`
	CollectionName string           `json:"collection_name,omitempty" db:"collection_name"`
	FloorPrice    float64           `json:"floor_price" db:"floor_price"`
	LastSalePrice float64           `json:"last_sale_price" db:"last_sale_price"`
	EstimatedUSD  float64           `json:"estimated_usd" db:"estimated_usd"`
	Attributes    []NFTAttribute    `json:"attributes,omitempty"`
	UpdatedAt     time.Time         `json:"updated_at" db:"updated_at"`
}

// NFTAttribute represents a trait of an NFT
type NFTAttribute struct {
	TraitType string `json:"trait_type"`
	Value     string `json:"value"`
}

// GasPrice represents current gas prices for a network
type GasPrice struct {
	Network   BlockchainNetwork `json:"network"`
	Slow      float64           `json:"slow"`      // Gwei
	Standard  float64           `json:"standard"`
	Fast      float64           `json:"fast"`
	Instant   float64           `json:"instant"`
	BaseFee   float64           `json:"base_fee"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// -------------------- Request/Response Types --------------------

// AddWalletRequest for adding a new wallet
type AddWalletRequest struct {
	Address    string            `json:"address" validate:"required"`
	Network    BlockchainNetwork `json:"network" validate:"required"`
	Label      string            `json:"label"`
	IsWatching bool              `json:"is_watching"`
}

// WalletResponse includes wallet with balances
type WalletResponse struct {
	Wallet     CryptoWallet    `json:"wallet"`
	Balances   []CryptoBalance `json:"balances"`
	TotalUSD   float64         `json:"total_usd"`
	NFTCount   int             `json:"nft_count"`
	DeFiCount  int             `json:"defi_positions_count"`
}

// PortfolioSummary represents overall crypto portfolio
type PortfolioSummary struct {
	TotalValueUSD     float64          `json:"total_value_usd"`
	TokensValueUSD    float64          `json:"tokens_value_usd"`
	NFTsValueUSD      float64          `json:"nfts_value_usd"`
	DeFiValueUSD      float64          `json:"defi_value_usd"`
	Change24h         float64          `json:"change_24h"`
	Change24hPercent  float64          `json:"change_24h_percent"`
	TopHoldings       []CryptoBalance  `json:"top_holdings"`
	WalletCount       int              `json:"wallet_count"`
	NetworkBreakdown  map[string]float64 `json:"network_breakdown"`
	LastSynced        time.Time        `json:"last_synced"`
}

// DeFiOverview represents DeFi positions summary
type DeFiOverview struct {
	TotalValueUSD    float64        `json:"total_value_usd"`
	TotalSupplied    float64        `json:"total_supplied"`
	TotalBorrowed    float64        `json:"total_borrowed"`
	NetAPY           float64        `json:"net_apy"`
	PendingRewards   float64        `json:"pending_rewards_usd"`
	Positions        []DeFiPosition `json:"positions"`
	HealthWarnings   []string       `json:"health_warnings,omitempty"`
}

// TokenPriceResponse for price queries
type TokenPriceResponse struct {
	Address       string    `json:"address"`
	Symbol        string    `json:"symbol"`
	Name          string    `json:"name"`
	Price         float64   `json:"price"`
	Change24h     float64   `json:"change_24h"`
	Change7d      float64   `json:"change_7d"`
	MarketCap     float64   `json:"market_cap"`
	Volume24h     float64   `json:"volume_24h"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// CreateAlertRequest for creating price alerts
type CreateAlertRequest struct {
	AlertType    string            `json:"alert_type" validate:"required"`
	TokenAddress string            `json:"token_address,omitempty"`
	TokenSymbol  string            `json:"token_symbol,omitempty"`
	Network      BlockchainNetwork `json:"network,omitempty"`
	TargetValue  float64           `json:"target_value" validate:"required"`
}

// CryptoTransactionFilter for filtering crypto transactions
type CryptoTransactionFilter struct {
	WalletID    *uuid.UUID `json:"wallet_id,omitempty"`
	Network     string     `json:"network,omitempty"`
	TokenSymbol string     `json:"token_symbol,omitempty"`
	TxType      string     `json:"tx_type,omitempty"`
	StartDate   *time.Time `json:"start_date,omitempty"`
	EndDate     *time.Time `json:"end_date,omitempty"`
	Limit       int        `json:"limit,omitempty"`
	Offset      int        `json:"offset,omitempty"`
}
