package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rezacr588/currency-converter/internal/model"
)

// CryptoDB handles crypto-related database operations
type CryptoDB struct {
	pool *pgxpool.Pool
}

// NewCryptoDB creates a new CryptoDB instance
func NewCryptoDB(pool *pgxpool.Pool) *CryptoDB {
	return &CryptoDB{pool: pool}
}

// -------------------- Wallet Operations --------------------

// CreateWallet adds a new crypto wallet
func (db *CryptoDB) CreateWallet(ctx context.Context, wallet *model.CryptoWallet) error {
	wallet.ID = uuid.New()
	wallet.CreatedAt = time.Now()
	wallet.UpdatedAt = time.Now()

	_, err := db.pool.Exec(ctx, `
		INSERT INTO crypto_wallets (id, user_id, address, network, label, is_watching, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, wallet.ID, wallet.UserID, wallet.Address, wallet.Network, wallet.Label, wallet.IsWatching, wallet.CreatedAt, wallet.UpdatedAt)

	return err
}

// GetWalletByID retrieves a wallet by ID
func (db *CryptoDB) GetWalletByID(ctx context.Context, id uuid.UUID) (*model.CryptoWallet, error) {
	var wallet model.CryptoWallet
	err := db.pool.QueryRow(ctx, `
		SELECT id, user_id, address, network, label, is_watching, last_synced, created_at, updated_at
		FROM crypto_wallets WHERE id = $1
	`, id).Scan(
		&wallet.ID, &wallet.UserID, &wallet.Address, &wallet.Network, &wallet.Label,
		&wallet.IsWatching, &wallet.LastSynced, &wallet.CreatedAt, &wallet.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &wallet, err
}

// GetUserWallets retrieves all wallets for a user
func (db *CryptoDB) GetUserWallets(ctx context.Context, userID uuid.UUID) ([]model.CryptoWallet, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT id, user_id, address, network, label, is_watching, last_synced, created_at, updated_at
		FROM crypto_wallets WHERE user_id = $1 ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var wallets []model.CryptoWallet
	for rows.Next() {
		var w model.CryptoWallet
		if err := rows.Scan(&w.ID, &w.UserID, &w.Address, &w.Network, &w.Label,
			&w.IsWatching, &w.LastSynced, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		wallets = append(wallets, w)
	}
	return wallets, rows.Err()
}

// UpdateWalletLastSynced updates the last synced timestamp
func (db *CryptoDB) UpdateWalletLastSynced(ctx context.Context, walletID uuid.UUID) error {
	now := time.Now()
	_, err := db.pool.Exec(ctx, `
		UPDATE crypto_wallets SET last_synced = $1, updated_at = $1 WHERE id = $2
	`, now, walletID)
	return err
}

// DeleteWallet removes a wallet and all associated data
func (db *CryptoDB) DeleteWallet(ctx context.Context, walletID uuid.UUID) error {
	_, err := db.pool.Exec(ctx, `DELETE FROM crypto_wallets WHERE id = $1`, walletID)
	return err
}

// -------------------- Balance Operations --------------------

// UpsertBalance creates or updates a token balance
func (db *CryptoDB) UpsertBalance(ctx context.Context, balance *model.CryptoBalance) error {
	balance.UpdatedAt = time.Now()

	_, err := db.pool.Exec(ctx, `
		INSERT INTO crypto_balances (id, wallet_id, token_address, token_symbol, token_name, 
			token_type, token_decimals, balance, balance_usd, price, price_change_24h, logo_url, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (wallet_id, token_address) DO UPDATE SET
			balance = EXCLUDED.balance,
			balance_usd = EXCLUDED.balance_usd,
			price = EXCLUDED.price,
			price_change_24h = EXCLUDED.price_change_24h,
			logo_url = EXCLUDED.logo_url,
			updated_at = EXCLUDED.updated_at
	`, uuid.New(), balance.WalletID, balance.TokenAddress, balance.TokenSymbol, balance.TokenName,
		balance.TokenType, balance.TokenDecimals, balance.Balance, balance.BalanceUSD,
		balance.Price, balance.PriceChange24h, balance.LogoURL, balance.UpdatedAt)

	return err
}

// GetWalletBalances retrieves all balances for a wallet
func (db *CryptoDB) GetWalletBalances(ctx context.Context, walletID uuid.UUID) ([]model.CryptoBalance, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT id, wallet_id, token_address, token_symbol, token_name, token_type,
			token_decimals, balance, balance_usd, price, price_change_24h, logo_url, updated_at
		FROM crypto_balances WHERE wallet_id = $1 ORDER BY balance_usd DESC
	`, walletID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var balances []model.CryptoBalance
	for rows.Next() {
		var b model.CryptoBalance
		if err := rows.Scan(&b.ID, &b.WalletID, &b.TokenAddress, &b.TokenSymbol, &b.TokenName,
			&b.TokenType, &b.TokenDecimals, &b.Balance, &b.BalanceUSD, &b.Price,
			&b.PriceChange24h, &b.LogoURL, &b.UpdatedAt); err != nil {
			return nil, err
		}
		balances = append(balances, b)
	}
	return balances, rows.Err()
}

// GetUserTotalBalance calculates total balance across all wallets
func (db *CryptoDB) GetUserTotalBalance(ctx context.Context, userID uuid.UUID) (float64, error) {
	var total float64
	err := db.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(cb.balance_usd), 0)
		FROM crypto_balances cb
		JOIN crypto_wallets cw ON cb.wallet_id = cw.id
		WHERE cw.user_id = $1
	`, userID).Scan(&total)
	return total, err
}

// DeleteWalletBalances removes all balances for a wallet
func (db *CryptoDB) DeleteWalletBalances(ctx context.Context, walletID uuid.UUID) error {
	_, err := db.pool.Exec(ctx, `DELETE FROM crypto_balances WHERE wallet_id = $1`, walletID)
	return err
}

// -------------------- Transaction Operations --------------------

// CreateTransaction adds a new crypto transaction
func (db *CryptoDB) CreateTransaction(ctx context.Context, tx *model.CryptoTransaction) error {
	tx.ID = uuid.New()
	tx.CreatedAt = time.Now()

	_, err := db.pool.Exec(ctx, `
		INSERT INTO crypto_transactions (id, wallet_id, tx_hash, network, from_address, to_address,
			token_address, token_symbol, amount, amount_usd, gas_fee, gas_fee_usd, tx_type,
			status, block_number, timestamp, linked_to_wallet, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
		ON CONFLICT (wallet_id, tx_hash) DO NOTHING
	`, tx.ID, tx.WalletID, tx.TxHash, tx.Network, tx.FromAddress, tx.ToAddress,
		tx.TokenAddress, tx.TokenSymbol, tx.Amount, tx.AmountUSD, tx.GasFee, tx.GasFeeUSD,
		tx.TxType, tx.Status, tx.BlockNumber, tx.Timestamp, tx.LinkedToWallet, tx.CreatedAt)

	return err
}

// GetWalletTransactions retrieves transactions for a wallet with filters
func (db *CryptoDB) GetWalletTransactions(ctx context.Context, walletID uuid.UUID, filter model.CryptoTransactionFilter) ([]model.CryptoTransaction, int, error) {
	args := []interface{}{walletID}
	argIdx := 2

	whereClause := "WHERE wallet_id = $1"

	if filter.TxType != "" {
		whereClause += " AND tx_type = $" + string(rune('0'+argIdx))
		args = append(args, filter.TxType)
		argIdx++
	}
	if filter.TokenSymbol != "" {
		whereClause += " AND token_symbol = $" + string(rune('0'+argIdx))
		args = append(args, filter.TokenSymbol)
		argIdx++
	}
	if filter.StartDate != nil {
		whereClause += " AND timestamp >= $" + string(rune('0'+argIdx))
		args = append(args, filter.StartDate)
		argIdx++
	}
	if filter.EndDate != nil {
		whereClause += " AND timestamp <= $" + string(rune('0'+argIdx))
		args = append(args, filter.EndDate)
		argIdx++
	}

	// Get total count
	var total int
	err := db.pool.QueryRow(ctx, `SELECT COUNT(*) FROM crypto_transactions `+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get paginated results
	limit := 50
	if filter.Limit > 0 && filter.Limit <= 500 {
		limit = filter.Limit
	}
	offset := filter.Offset

	query := `
		SELECT id, wallet_id, tx_hash, network, from_address, to_address, token_address,
			token_symbol, amount, amount_usd, gas_fee, gas_fee_usd, tx_type, status,
			block_number, timestamp, linked_to_wallet, created_at
		FROM crypto_transactions ` + whereClause + `
		ORDER BY timestamp DESC LIMIT $` + string(rune('0'+argIdx)) + ` OFFSET $` + string(rune('0'+argIdx+1))

	args = append(args, limit, offset)

	rows, err := db.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var txs []model.CryptoTransaction
	for rows.Next() {
		var t model.CryptoTransaction
		if err := rows.Scan(&t.ID, &t.WalletID, &t.TxHash, &t.Network, &t.FromAddress, &t.ToAddress,
			&t.TokenAddress, &t.TokenSymbol, &t.Amount, &t.AmountUSD, &t.GasFee, &t.GasFeeUSD,
			&t.TxType, &t.Status, &t.BlockNumber, &t.Timestamp, &t.LinkedToWallet, &t.CreatedAt); err != nil {
			return nil, 0, err
		}
		txs = append(txs, t)
	}
	return txs, total, rows.Err()
}

// -------------------- DeFi Position Operations --------------------

// UpsertDeFiPosition creates or updates a DeFi position
func (db *CryptoDB) UpsertDeFiPosition(ctx context.Context, pos *model.DeFiPosition) error {
	pos.UpdatedAt = time.Now()

	suppliedJSON, _ := json.Marshal(pos.SuppliedTokens)
	borrowedJSON, _ := json.Marshal(pos.BorrowedTokens)
	lpJSON, _ := json.Marshal(pos.LPTokens)
	rewardsJSON, _ := json.Marshal(pos.PendingRewards)

	_, err := db.pool.Exec(ctx, `
		INSERT INTO defi_positions (id, wallet_id, protocol, protocol_type, network, position_type,
			supplied_tokens, supplied_usd, borrowed_tokens, borrowed_usd, lp_tokens, pool_share,
			pending_rewards, rewards_usd, health_factor, liquidation_risk, apy, apr, total_value_usd, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
		ON CONFLICT (wallet_id, protocol, network, position_type) DO UPDATE SET
			supplied_tokens = EXCLUDED.supplied_tokens,
			supplied_usd = EXCLUDED.supplied_usd,
			borrowed_tokens = EXCLUDED.borrowed_tokens,
			borrowed_usd = EXCLUDED.borrowed_usd,
			lp_tokens = EXCLUDED.lp_tokens,
			pool_share = EXCLUDED.pool_share,
			pending_rewards = EXCLUDED.pending_rewards,
			rewards_usd = EXCLUDED.rewards_usd,
			health_factor = EXCLUDED.health_factor,
			liquidation_risk = EXCLUDED.liquidation_risk,
			apy = EXCLUDED.apy,
			apr = EXCLUDED.apr,
			total_value_usd = EXCLUDED.total_value_usd,
			updated_at = EXCLUDED.updated_at
	`, uuid.New(), pos.WalletID, pos.Protocol, pos.ProtocolType, pos.Network, pos.PositionType,
		suppliedJSON, pos.SuppliedUSD, borrowedJSON, pos.BorrowedUSD, lpJSON, pos.PoolShare,
		rewardsJSON, pos.RewardsUSD, pos.HealthFactor, pos.LiquidationRisk, pos.APY, pos.APR,
		pos.TotalValueUSD, pos.UpdatedAt)

	return err
}

// GetWalletDeFiPositions retrieves DeFi positions for a wallet
func (db *CryptoDB) GetWalletDeFiPositions(ctx context.Context, walletID uuid.UUID) ([]model.DeFiPosition, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT id, wallet_id, protocol, protocol_type, network, position_type,
			supplied_tokens, supplied_usd, borrowed_tokens, borrowed_usd, lp_tokens, pool_share,
			pending_rewards, rewards_usd, health_factor, liquidation_risk, apy, apr, total_value_usd, updated_at
		FROM defi_positions WHERE wallet_id = $1 ORDER BY total_value_usd DESC
	`, walletID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var positions []model.DeFiPosition
	for rows.Next() {
		var p model.DeFiPosition
		var suppliedJSON, borrowedJSON, lpJSON, rewardsJSON []byte
		if err := rows.Scan(&p.ID, &p.WalletID, &p.Protocol, &p.ProtocolType, &p.Network, &p.PositionType,
			&suppliedJSON, &p.SuppliedUSD, &borrowedJSON, &p.BorrowedUSD, &lpJSON, &p.PoolShare,
			&rewardsJSON, &p.RewardsUSD, &p.HealthFactor, &p.LiquidationRisk, &p.APY, &p.APR,
			&p.TotalValueUSD, &p.UpdatedAt); err != nil {
			return nil, err
		}
		json.Unmarshal(suppliedJSON, &p.SuppliedTokens)
		json.Unmarshal(borrowedJSON, &p.BorrowedTokens)
		json.Unmarshal(lpJSON, &p.LPTokens)
		json.Unmarshal(rewardsJSON, &p.PendingRewards)
		positions = append(positions, p)
	}
	return positions, rows.Err()
}

// GetUserDeFiPositions retrieves all DeFi positions for a user
func (db *CryptoDB) GetUserDeFiPositions(ctx context.Context, userID uuid.UUID) ([]model.DeFiPosition, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT dp.id, dp.wallet_id, dp.protocol, dp.protocol_type, dp.network, dp.position_type,
			dp.supplied_tokens, dp.supplied_usd, dp.borrowed_tokens, dp.borrowed_usd, dp.lp_tokens, dp.pool_share,
			dp.pending_rewards, dp.rewards_usd, dp.health_factor, dp.liquidation_risk, dp.apy, dp.apr, 
			dp.total_value_usd, dp.updated_at
		FROM defi_positions dp
		JOIN crypto_wallets cw ON dp.wallet_id = cw.id
		WHERE cw.user_id = $1 ORDER BY dp.total_value_usd DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var positions []model.DeFiPosition
	for rows.Next() {
		var p model.DeFiPosition
		var suppliedJSON, borrowedJSON, lpJSON, rewardsJSON []byte
		if err := rows.Scan(&p.ID, &p.WalletID, &p.Protocol, &p.ProtocolType, &p.Network, &p.PositionType,
			&suppliedJSON, &p.SuppliedUSD, &borrowedJSON, &p.BorrowedUSD, &lpJSON, &p.PoolShare,
			&rewardsJSON, &p.RewardsUSD, &p.HealthFactor, &p.LiquidationRisk, &p.APY, &p.APR,
			&p.TotalValueUSD, &p.UpdatedAt); err != nil {
			return nil, err
		}
		json.Unmarshal(suppliedJSON, &p.SuppliedTokens)
		json.Unmarshal(borrowedJSON, &p.BorrowedTokens)
		json.Unmarshal(lpJSON, &p.LPTokens)
		json.Unmarshal(rewardsJSON, &p.PendingRewards)
		positions = append(positions, p)
	}
	return positions, rows.Err()
}

// -------------------- NFT Operations --------------------

// UpsertNFT creates or updates an NFT asset
func (db *CryptoDB) UpsertNFT(ctx context.Context, nft *model.NFTAsset) error {
	nft.UpdatedAt = time.Now()
	attrsJSON, _ := json.Marshal(nft.Attributes)

	_, err := db.pool.Exec(ctx, `
		INSERT INTO nft_assets (id, wallet_id, contract_address, token_id, network, name, description,
			image_url, collection_name, floor_price, last_sale_price, estimated_usd, attributes, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (wallet_id, contract_address, token_id, network) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			image_url = EXCLUDED.image_url,
			collection_name = EXCLUDED.collection_name,
			floor_price = EXCLUDED.floor_price,
			last_sale_price = EXCLUDED.last_sale_price,
			estimated_usd = EXCLUDED.estimated_usd,
			attributes = EXCLUDED.attributes,
			updated_at = EXCLUDED.updated_at
	`, uuid.New(), nft.WalletID, nft.ContractAddr, nft.TokenID, nft.Network, nft.Name, nft.Description,
		nft.ImageURL, nft.CollectionName, nft.FloorPrice, nft.LastSalePrice, nft.EstimatedUSD, attrsJSON, nft.UpdatedAt)

	return err
}

// GetWalletNFTs retrieves NFTs for a wallet
func (db *CryptoDB) GetWalletNFTs(ctx context.Context, walletID uuid.UUID) ([]model.NFTAsset, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT id, wallet_id, contract_address, token_id, network, name, description,
			image_url, collection_name, floor_price, last_sale_price, estimated_usd, attributes, updated_at
		FROM nft_assets WHERE wallet_id = $1 ORDER BY estimated_usd DESC
	`, walletID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nfts []model.NFTAsset
	for rows.Next() {
		var n model.NFTAsset
		var attrsJSON []byte
		if err := rows.Scan(&n.ID, &n.WalletID, &n.ContractAddr, &n.TokenID, &n.Network, &n.Name,
			&n.Description, &n.ImageURL, &n.CollectionName, &n.FloorPrice, &n.LastSalePrice,
			&n.EstimatedUSD, &attrsJSON, &n.UpdatedAt); err != nil {
			return nil, err
		}
		json.Unmarshal(attrsJSON, &n.Attributes)
		nfts = append(nfts, n)
	}
	return nfts, rows.Err()
}

// GetUserNFTCount returns total NFT count for a user
func (db *CryptoDB) GetUserNFTCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := db.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM nft_assets na
		JOIN crypto_wallets cw ON na.wallet_id = cw.id
		WHERE cw.user_id = $1
	`, userID).Scan(&count)
	return count, err
}

// GetUserNFTValue returns total NFT value for a user
func (db *CryptoDB) GetUserNFTValue(ctx context.Context, userID uuid.UUID) (float64, error) {
	var value float64
	err := db.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(na.estimated_usd), 0) FROM nft_assets na
		JOIN crypto_wallets cw ON na.wallet_id = cw.id
		WHERE cw.user_id = $1
	`, userID).Scan(&value)
	return value, err
}

// -------------------- Alert Operations --------------------

// CreateAlert creates a new price alert
func (db *CryptoDB) CreateAlert(ctx context.Context, alert *model.CryptoAlert) error {
	alert.ID = uuid.New()
	alert.CreatedAt = time.Now()
	alert.IsActive = true

	_, err := db.pool.Exec(ctx, `
		INSERT INTO crypto_alerts (id, user_id, alert_type, token_address, token_symbol, network,
			target_value, current_value, is_triggered, is_active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, alert.ID, alert.UserID, alert.AlertType, alert.TokenAddress, alert.TokenSymbol, alert.Network,
		alert.TargetValue, alert.CurrentValue, alert.IsTriggered, alert.IsActive, alert.CreatedAt)

	return err
}

// GetUserAlerts retrieves active alerts for a user
func (db *CryptoDB) GetUserAlerts(ctx context.Context, userID uuid.UUID, activeOnly bool) ([]model.CryptoAlert, error) {
	query := `
		SELECT id, user_id, alert_type, token_address, token_symbol, network,
			target_value, current_value, is_triggered, is_active, triggered_at, created_at
		FROM crypto_alerts WHERE user_id = $1`
	if activeOnly {
		query += ` AND is_active = true`
	}
	query += ` ORDER BY created_at DESC`

	rows, err := db.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []model.CryptoAlert
	for rows.Next() {
		var a model.CryptoAlert
		if err := rows.Scan(&a.ID, &a.UserID, &a.AlertType, &a.TokenAddress, &a.TokenSymbol, &a.Network,
			&a.TargetValue, &a.CurrentValue, &a.IsTriggered, &a.IsActive, &a.TriggeredAt, &a.CreatedAt); err != nil {
			return nil, err
		}
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}

// TriggerAlert marks an alert as triggered
func (db *CryptoDB) TriggerAlert(ctx context.Context, alertID uuid.UUID, currentValue float64) error {
	now := time.Now()
	_, err := db.pool.Exec(ctx, `
		UPDATE crypto_alerts SET is_triggered = true, triggered_at = $1, current_value = $2
		WHERE id = $3
	`, now, currentValue, alertID)
	return err
}

// DeleteAlert removes an alert
func (db *CryptoDB) DeleteAlert(ctx context.Context, alertID uuid.UUID) error {
	_, err := db.pool.Exec(ctx, `DELETE FROM crypto_alerts WHERE id = $1`, alertID)
	return err
}

// -------------------- Token Price Cache --------------------

// UpsertTokenPrice updates token price cache
func (db *CryptoDB) UpsertTokenPrice(ctx context.Context, price *model.TokenPriceResponse, network string) error {
	_, err := db.pool.Exec(ctx, `
		INSERT INTO token_prices (address, network, symbol, name, price, change_24h, change_7d, market_cap, volume_24h, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (address, network) DO UPDATE SET
			price = EXCLUDED.price,
			change_24h = EXCLUDED.change_24h,
			change_7d = EXCLUDED.change_7d,
			market_cap = EXCLUDED.market_cap,
			volume_24h = EXCLUDED.volume_24h,
			updated_at = EXCLUDED.updated_at
	`, price.Address, network, price.Symbol, price.Name, price.Price, price.Change24h, price.Change7d,
		price.MarketCap, price.Volume24h, time.Now())

	return err
}

// GetTokenPrice retrieves cached token price
func (db *CryptoDB) GetTokenPrice(ctx context.Context, address, network string) (*model.TokenPriceResponse, error) {
	var p model.TokenPriceResponse
	err := db.pool.QueryRow(ctx, `
		SELECT address, symbol, name, price, change_24h, change_7d, market_cap, volume_24h, updated_at
		FROM token_prices WHERE address = $1 AND network = $2
	`, address, network).Scan(&p.Address, &p.Symbol, &p.Name, &p.Price, &p.Change24h, &p.Change7d,
		&p.MarketCap, &p.Volume24h, &p.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &p, err
}

// GetNetworkBreakdown calculates value by network for a user
func (db *CryptoDB) GetNetworkBreakdown(ctx context.Context, userID uuid.UUID) (map[string]float64, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT cw.network, COALESCE(SUM(cb.balance_usd), 0) as total
		FROM crypto_wallets cw
		LEFT JOIN crypto_balances cb ON cw.id = cb.wallet_id
		WHERE cw.user_id = $1
		GROUP BY cw.network
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	breakdown := make(map[string]float64)
	for rows.Next() {
		var network string
		var total float64
		if err := rows.Scan(&network, &total); err != nil {
			return nil, err
		}
		breakdown[network] = total
	}
	return breakdown, rows.Err()
}
