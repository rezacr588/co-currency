package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// CryptoService handles crypto portfolio operations
type CryptoService struct {
	db            *repository.CryptoDB
	alchemyAPIKey string
	moralisAPIKey string
	httpClient    *http.Client
}

// NewCryptoService creates a new CryptoService instance
func NewCryptoService(db *repository.CryptoDB, alchemyKey, moralisKey string) *CryptoService {
	return &CryptoService{
		db:            db,
		alchemyAPIKey: alchemyKey,
		moralisAPIKey: moralisKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// -------------------- Wallet Operations --------------------

// AddWallet adds a new crypto wallet for a user
func (s *CryptoService) AddWallet(ctx context.Context, userID uuid.UUID, req model.AddWalletRequest) (*model.CryptoWallet, error) {
	// Validate address format based on network
	if !s.isValidAddress(req.Address, req.Network) {
		return nil, fmt.Errorf("invalid wallet address for network %s", req.Network)
	}

	wallet := &model.CryptoWallet{
		UserID:     userID,
		Address:    strings.ToLower(req.Address),
		Network:    req.Network,
		Label:      req.Label,
		IsWatching: req.IsWatching,
	}

	if err := s.db.CreateWallet(ctx, wallet); err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return nil, fmt.Errorf("wallet already added")
		}
		return nil, err
	}

	// Trigger initial sync in background
	go func() {
		bgCtx := context.Background()
		if err := s.SyncWallet(bgCtx, wallet.ID); err != nil {
			log.Error().Err(err).Str("wallet_id", wallet.ID.String()).Msg("Failed to sync new wallet")
		}
	}()

	return wallet, nil
}

// GetWallet retrieves a wallet with balances
func (s *CryptoService) GetWallet(ctx context.Context, walletID uuid.UUID) (*model.WalletResponse, error) {
	wallet, err := s.db.GetWalletByID(ctx, walletID)
	if err != nil {
		return nil, err
	}
	if wallet == nil {
		return nil, fmt.Errorf("wallet not found")
	}

	balances, err := s.db.GetWalletBalances(ctx, walletID)
	if err != nil {
		return nil, err
	}

	nfts, err := s.db.GetWalletNFTs(ctx, walletID)
	if err != nil {
		return nil, err
	}

	defiPositions, err := s.db.GetWalletDeFiPositions(ctx, walletID)
	if err != nil {
		return nil, err
	}

	var totalUSD float64
	for _, b := range balances {
		totalUSD += b.BalanceUSD
	}

	return &model.WalletResponse{
		Wallet:     *wallet,
		Balances:   balances,
		TotalUSD:   totalUSD,
		NFTCount:   len(nfts),
		DeFiCount:  len(defiPositions),
	}, nil
}

// GetUserWallets retrieves all wallets for a user
func (s *CryptoService) GetUserWallets(ctx context.Context, userID uuid.UUID) ([]model.CryptoWallet, error) {
	return s.db.GetUserWallets(ctx, userID)
}

// DeleteWallet removes a wallet
func (s *CryptoService) DeleteWallet(ctx context.Context, userID, walletID uuid.UUID) error {
	wallet, err := s.db.GetWalletByID(ctx, walletID)
	if err != nil {
		return err
	}
	if wallet == nil || wallet.UserID != userID {
		return fmt.Errorf("wallet not found")
	}
	return s.db.DeleteWallet(ctx, walletID)
}

// -------------------- Portfolio Operations --------------------

// GetPortfolioSummary returns overall portfolio summary for a user
func (s *CryptoService) GetPortfolioSummary(ctx context.Context, userID uuid.UUID) (*model.PortfolioSummary, error) {
	wallets, err := s.db.GetUserWallets(ctx, userID)
	if err != nil {
		return nil, err
	}

	totalTokens, err := s.db.GetUserTotalBalance(ctx, userID)
	if err != nil {
		return nil, err
	}

	nftValue, err := s.db.GetUserNFTValue(ctx, userID)
	if err != nil {
		return nil, err
	}

	defiPositions, err := s.db.GetUserDeFiPositions(ctx, userID)
	if err != nil {
		return nil, err
	}

	var defiValue float64
	for _, p := range defiPositions {
		defiValue += p.TotalValueUSD
	}

	networkBreakdown, err := s.db.GetNetworkBreakdown(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Get top holdings
	var topHoldings []model.CryptoBalance
	for _, w := range wallets {
		balances, _ := s.db.GetWalletBalances(ctx, w.ID)
		topHoldings = append(topHoldings, balances...)
	}
	// Sort and limit to top 10
	if len(topHoldings) > 10 {
		topHoldings = topHoldings[:10]
	}

	// Calculate 24h change (simplified - would need historical data)
	var change24h, change24hPercent float64
	for _, b := range topHoldings {
		change24h += b.BalanceUSD * (b.PriceChange24h / 100)
	}
	total := totalTokens + nftValue + defiValue
	if total > 0 {
		change24hPercent = (change24h / total) * 100
	}

	return &model.PortfolioSummary{
		TotalValueUSD:    total,
		TokensValueUSD:   totalTokens,
		NFTsValueUSD:     nftValue,
		DeFiValueUSD:     defiValue,
		Change24h:        change24h,
		Change24hPercent: change24hPercent,
		TopHoldings:      topHoldings,
		WalletCount:      len(wallets),
		NetworkBreakdown: networkBreakdown,
		LastSynced:       time.Now(),
	}, nil
}

// GetDeFiOverview returns DeFi positions summary
func (s *CryptoService) GetDeFiOverview(ctx context.Context, userID uuid.UUID) (*model.DeFiOverview, error) {
	positions, err := s.db.GetUserDeFiPositions(ctx, userID)
	if err != nil {
		return nil, err
	}

	var totalValue, totalSupplied, totalBorrowed, pendingRewards float64
	var warnings []string

	for _, p := range positions {
		totalValue += p.TotalValueUSD
		totalSupplied += p.SuppliedUSD
		totalBorrowed += p.BorrowedUSD
		pendingRewards += p.RewardsUSD

		// Check for health warnings
		if p.HealthFactor != nil && *p.HealthFactor < 1.5 {
			warnings = append(warnings, fmt.Sprintf("%s position has low health factor: %.2f", p.Protocol, *p.HealthFactor))
		}
		if p.LiquidationRisk == "high" {
			warnings = append(warnings, fmt.Sprintf("%s position has high liquidation risk", p.Protocol))
		}
	}

	// Calculate net APY
	var netAPY float64
	if totalValue > 0 {
		for _, p := range positions {
			weight := p.TotalValueUSD / totalValue
			netAPY += p.APY * weight
		}
	}

	return &model.DeFiOverview{
		TotalValueUSD:  totalValue,
		TotalSupplied:  totalSupplied,
		TotalBorrowed:  totalBorrowed,
		NetAPY:         netAPY,
		PendingRewards: pendingRewards,
		Positions:      positions,
		HealthWarnings: warnings,
	}, nil
}

// -------------------- Sync Operations --------------------

// SyncWallet syncs wallet data from blockchain
func (s *CryptoService) SyncWallet(ctx context.Context, walletID uuid.UUID) error {
	wallet, err := s.db.GetWalletByID(ctx, walletID)
	if err != nil {
		return err
	}
	if wallet == nil {
		return fmt.Errorf("wallet not found")
	}

	// Sync token balances
	if err := s.syncTokenBalances(ctx, wallet); err != nil {
		log.Error().Err(err).Msg("Failed to sync token balances")
	}

	// Sync transactions
	if err := s.syncTransactions(ctx, wallet); err != nil {
		log.Error().Err(err).Msg("Failed to sync transactions")
	}

	// Sync NFTs
	if err := s.syncNFTs(ctx, wallet); err != nil {
		log.Error().Err(err).Msg("Failed to sync NFTs")
	}

	// Sync DeFi positions
	if err := s.syncDeFiPositions(ctx, wallet); err != nil {
		log.Error().Err(err).Msg("Failed to sync DeFi positions")
	}

	// Update last synced
	return s.db.UpdateWalletLastSynced(ctx, walletID)
}

// SyncAllUserWallets syncs all wallets for a user
func (s *CryptoService) SyncAllUserWallets(ctx context.Context, userID uuid.UUID) error {
	wallets, err := s.db.GetUserWallets(ctx, userID)
	if err != nil {
		return err
	}

	for _, w := range wallets {
		if err := s.SyncWallet(ctx, w.ID); err != nil {
			log.Error().Err(err).Str("wallet_id", w.ID.String()).Msg("Failed to sync wallet")
		}
	}
	return nil
}

// -------------------- Transaction Operations --------------------

// GetWalletTransactions retrieves transactions for a wallet
func (s *CryptoService) GetWalletTransactions(ctx context.Context, walletID uuid.UUID, filter model.CryptoTransactionFilter) ([]model.CryptoTransaction, int, error) {
	return s.db.GetWalletTransactions(ctx, walletID, filter)
}

// -------------------- Alert Operations --------------------

// CreateAlert creates a new price alert
func (s *CryptoService) CreateAlert(ctx context.Context, userID uuid.UUID, req model.CreateAlertRequest) (*model.CryptoAlert, error) {
	alert := &model.CryptoAlert{
		UserID:       userID,
		AlertType:    req.AlertType,
		TokenAddress: req.TokenAddress,
		TokenSymbol:  req.TokenSymbol,
		Network:      req.Network,
		TargetValue:  req.TargetValue,
	}

	if err := s.db.CreateAlert(ctx, alert); err != nil {
		return nil, err
	}

	return alert, nil
}

// GetUserAlerts retrieves alerts for a user
func (s *CryptoService) GetUserAlerts(ctx context.Context, userID uuid.UUID, activeOnly bool) ([]model.CryptoAlert, error) {
	return s.db.GetUserAlerts(ctx, userID, activeOnly)
}

// DeleteAlert removes an alert
func (s *CryptoService) DeleteAlert(ctx context.Context, userID, alertID uuid.UUID) error {
	// Verify ownership through query
	alerts, err := s.db.GetUserAlerts(ctx, userID, false)
	if err != nil {
		return err
	}
	for _, a := range alerts {
		if a.ID == alertID {
			return s.db.DeleteAlert(ctx, alertID)
		}
	}
	return fmt.Errorf("alert not found")
}

// -------------------- Price Operations --------------------

// GetTokenPrice retrieves current token price
func (s *CryptoService) GetTokenPrice(ctx context.Context, address, network string) (*model.TokenPriceResponse, error) {
	// Check cache first
	cached, err := s.db.GetTokenPrice(ctx, address, network)
	if err == nil && cached != nil && time.Since(cached.UpdatedAt) < 5*time.Minute {
		return cached, nil
	}

	// Fetch from API
	price, err := s.fetchTokenPrice(ctx, address, network)
	if err != nil {
		// Return stale cache if available
		if cached != nil {
			return cached, nil
		}
		return nil, err
	}

	// Update cache
	s.db.UpsertTokenPrice(ctx, price, network)

	return price, nil
}

// GetGasPrices retrieves current gas prices for a network
func (s *CryptoService) GetGasPrices(ctx context.Context, network model.BlockchainNetwork) (*model.GasPrice, error) {
	if s.alchemyAPIKey == "" {
		return s.getDefaultGasPrices(network), nil
	}

	alchemyURL := s.getAlchemyURL(network)
	if alchemyURL == "" {
		return s.getDefaultGasPrices(network), nil
	}

	// Get base fee from latest block
	payload := `{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}`
	req, err := http.NewRequestWithContext(ctx, "POST", alchemyURL, strings.NewReader(payload))
	if err != nil {
		return s.getDefaultGasPrices(network), nil
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return s.getDefaultGasPrices(network), nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return s.getDefaultGasPrices(network), nil
	}

	var result struct {
		Result string `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return s.getDefaultGasPrices(network), nil
	}

	// Convert hex to Gwei (1 Gwei = 10^9 wei)
	baseFeeWei := s.hexToFloat(result.Result, 0)
	baseFeeGwei := baseFeeWei / 1e9

	// Calculate different speed tiers
	return &model.GasPrice{
		Network:   network,
		Slow:      baseFeeGwei * 0.8,
		Standard:  baseFeeGwei,
		Fast:      baseFeeGwei * 1.5,
		Instant:   baseFeeGwei * 2.0,
		BaseFee:   baseFeeGwei,
		UpdatedAt: time.Now(),
	}, nil
}

func (s *CryptoService) getDefaultGasPrices(network model.BlockchainNetwork) *model.GasPrice {
	// Default gas prices by network (approximate)
	defaults := map[model.BlockchainNetwork]struct{ slow, standard, fast, instant float64 }{
		model.NetworkEthereum:  {20, 30, 50, 80},
		model.NetworkPolygon:   {30, 50, 80, 120},
		model.NetworkArbitrum:  {0.1, 0.15, 0.2, 0.3},
		model.NetworkOptimism:  {0.001, 0.002, 0.003, 0.005},
		model.NetworkBase:      {0.01, 0.015, 0.02, 0.03},
		model.NetworkBSC:       {3, 5, 8, 12},
		model.NetworkAvalanche: {25, 30, 40, 60},
	}

	if d, ok := defaults[network]; ok {
		return &model.GasPrice{
			Network:   network,
			Slow:      d.slow,
			Standard:  d.standard,
			Fast:      d.fast,
			Instant:   d.instant,
			BaseFee:   d.standard,
			UpdatedAt: time.Now(),
		}
	}

	return &model.GasPrice{
		Network:   network,
		Slow:      20,
		Standard:  30,
		Fast:      50,
		Instant:   80,
		BaseFee:   30,
		UpdatedAt: time.Now(),
	}
}

// -------------------- Internal Sync Methods --------------------

func (s *CryptoService) syncTokenBalances(ctx context.Context, wallet *model.CryptoWallet) error {
	if s.alchemyAPIKey == "" {
		log.Debug().Msg("Alchemy API key not configured, skipping token sync")
		return nil
	}

	// Get network-specific Alchemy URL
	alchemyURL := s.getAlchemyURL(wallet.Network)
	if alchemyURL == "" {
		return nil
	}

	// Fetch token balances using Alchemy API
	payload := fmt.Sprintf(`{
		"jsonrpc": "2.0",
		"method": "alchemy_getTokenBalances",
		"params": ["%s"],
		"id": 1
	}`, wallet.Address)

	resp, err := s.httpClient.Post(alchemyURL, "application/json", strings.NewReader(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var result struct {
		Result struct {
			TokenBalances []struct {
				ContractAddress string `json:"contractAddress"`
				TokenBalance    string `json:"tokenBalance"`
			} `json:"tokenBalances"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return err
	}

	// Process each token balance
	for _, tb := range result.Result.TokenBalances {
		if tb.TokenBalance == "0x0" || tb.TokenBalance == "" {
			continue
		}

		// Fetch token metadata and price
		metadata, _ := s.fetchTokenMetadata(ctx, tb.ContractAddress, wallet.Network)
		price, _ := s.GetTokenPrice(ctx, tb.ContractAddress, string(wallet.Network))

		balance := &model.CryptoBalance{
			WalletID:      wallet.ID,
			TokenAddress:  tb.ContractAddress,
			TokenSymbol:   metadata.Symbol,
			TokenName:     metadata.Name,
			TokenType:     model.TokenTypeERC20,
			TokenDecimals: metadata.Decimals,
			Balance:       tb.TokenBalance,
			LogoURL:       metadata.Logo,
		}

		if price != nil {
			balance.Price = price.Price
			balance.PriceChange24h = price.Change24h
			// Calculate USD value (simplified)
			balance.BalanceUSD = price.Price * s.hexToFloat(tb.TokenBalance, metadata.Decimals)
		}

		if err := s.db.UpsertBalance(ctx, balance); err != nil {
			log.Warn().Err(err).Str("wallet_id", wallet.ID.String()).Msg("failed to upsert crypto balance")
		}
	}

	// Also get native balance
	return s.syncNativeBalance(ctx, wallet)
}

func (s *CryptoService) syncNativeBalance(ctx context.Context, wallet *model.CryptoWallet) error {
	alchemyURL := s.getAlchemyURL(wallet.Network)
	if alchemyURL == "" {
		return nil
	}

	payload := fmt.Sprintf(`{
		"jsonrpc": "2.0",
		"method": "eth_getBalance",
		"params": ["%s", "latest"],
		"id": 1
	}`, wallet.Address)

	resp, err := s.httpClient.Post(alchemyURL, "application/json", strings.NewReader(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		body = []byte("(read error)")
	}

	var result struct {
		Result string `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return err
	}

	nativeSymbol := s.getNativeSymbol(wallet.Network)
	price, _ := s.GetTokenPrice(ctx, "native", string(wallet.Network))

	balance := &model.CryptoBalance{
		WalletID:      wallet.ID,
		TokenAddress:  "native",
		TokenSymbol:   nativeSymbol,
		TokenName:     nativeSymbol,
		TokenType:     model.TokenTypeNative,
		TokenDecimals: 18,
		Balance:       result.Result,
	}

	if price != nil {
		balance.Price = price.Price
		balance.PriceChange24h = price.Change24h
		balance.BalanceUSD = price.Price * s.hexToFloat(result.Result, 18)
	}

	return s.db.UpsertBalance(ctx, balance)
}

func (s *CryptoService) syncTransactions(ctx context.Context, wallet *model.CryptoWallet) error {
	if s.alchemyAPIKey == "" {
		return nil
	}

	alchemyURL := s.getAlchemyURL(wallet.Network)
	if alchemyURL == "" {
		return nil
	}

	// Fetch recent asset transfers
	payload := fmt.Sprintf(`{
		"jsonrpc": "2.0",
		"method": "alchemy_getAssetTransfers",
		"params": [{
			"fromAddress": "%s",
			"category": ["external", "internal", "erc20", "erc721"],
			"maxCount": "0x64"
		}],
		"id": 1
	}`, wallet.Address)

	resp, err := s.httpClient.Post(alchemyURL, "application/json", strings.NewReader(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		body = []byte("(read error)")
	}

	var result struct {
		Result struct {
			Transfers []struct {
				Hash        string `json:"hash"`
				From        string `json:"from"`
				To          string `json:"to"`
				Value       float64 `json:"value"`
				Asset       string `json:"asset"`
				Category    string `json:"category"`
				BlockNum    string `json:"blockNum"`
			} `json:"transfers"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return err
	}

	for _, t := range result.Result.Transfers {
		txType := "send"
		if strings.EqualFold(t.To, wallet.Address) {
			txType = "receive"
		}

		tx := &model.CryptoTransaction{
			WalletID:     wallet.ID,
			TxHash:       t.Hash,
			Network:      wallet.Network,
			FromAddress:  t.From,
			ToAddress:    t.To,
			TokenAddress: "native",
			TokenSymbol:  t.Asset,
			Amount:       fmt.Sprintf("%f", t.Value),
			TxType:       txType,
			Status:       "confirmed",
			Timestamp:    time.Now(), // Would parse from block
		}

		if err := s.db.CreateTransaction(ctx, tx); err != nil {
			log.Warn().Err(err).Str("tx_hash", t.Hash).Msg("failed to create crypto transaction")
		}
	}

	return nil
}

func (s *CryptoService) syncNFTs(ctx context.Context, wallet *model.CryptoWallet) error {
	if s.alchemyAPIKey == "" {
		return nil
	}

	alchemyURL := s.getAlchemyURL(wallet.Network)
	if alchemyURL == "" {
		return nil
	}

	payload := fmt.Sprintf(`{
		"jsonrpc": "2.0",
		"method": "alchemy_getNFTs",
		"params": {
			"owner": "%s"
		},
		"id": 1
	}`, wallet.Address)

	resp, err := s.httpClient.Post(alchemyURL, "application/json", strings.NewReader(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		body = []byte("(read error)")
	}

	var result struct {
		Result struct {
			OwnedNfts []struct {
				Contract struct {
					Address string `json:"address"`
				} `json:"contract"`
				TokenId string `json:"tokenId"`
				Title   string `json:"title"`
				Description string `json:"description"`
				Media []struct {
					Gateway string `json:"gateway"`
				} `json:"media"`
			} `json:"ownedNfts"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return err
	}

	for _, n := range result.Result.OwnedNfts {
		imageURL := ""
		if len(n.Media) > 0 {
			imageURL = n.Media[0].Gateway
		}

		nft := &model.NFTAsset{
			WalletID:     wallet.ID,
			ContractAddr: n.Contract.Address,
			TokenID:      n.TokenId,
			Network:      wallet.Network,
			Name:         n.Title,
			Description:  n.Description,
			ImageURL:     imageURL,
		}

		if err := s.db.UpsertNFT(ctx, nft); err != nil {
			log.Warn().Err(err).Str("wallet_id", wallet.ID.String()).Msg("failed to upsert NFT")
		}
	}

	return nil
}

func (s *CryptoService) syncDeFiPositions(ctx context.Context, wallet *model.CryptoWallet) error {
	// DeBank API for DeFi protocol detection (free tier: 200 calls/day)
	// Alternative: Zapper API, but DeBank has better protocol coverage
	
	// Only sync for EVM chains
	if wallet.Network == model.NetworkSolana {
		return nil
	}

	url := fmt.Sprintf(
		"https://pro-openapi.debank.com/v1/user/all_complex_protocol_list?id=%s",
		wallet.Address,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		log.Debug().Err(err).Msg("Failed to create DeBank request")
		return nil
	}
	req.Header.Set("Accept", "application/json")
	// DeBank requires API key for higher rate limits, but works without for basic usage
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Debug().Err(err).Msg("DeBank API call failed")
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Debug().Int("status", resp.StatusCode).Msg("DeBank returned non-200 status")
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	var protocols []struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Chain   string `json:"chain"`
		LogoURL string `json:"logo_url"`
		Portfolio []struct {
			Name  string `json:"name"`
			Stats struct {
				AssetUSD     float64 `json:"asset_usd_value"`
				DebtUSD      float64 `json:"debt_usd_value"`
				NetUSD       float64 `json:"net_usd_value"`
			} `json:"stats"`
			DetailTypes []string `json:"detail_types"`
			Detail struct {
				SupplyTokenList []struct {
					Symbol string  `json:"symbol"`
					Amount float64 `json:"amount"`
					Price  float64 `json:"price"`
				} `json:"supply_token_list"`
				BorrowTokenList []struct {
					Symbol string  `json:"symbol"`
					Amount float64 `json:"amount"`
					Price  float64 `json:"price"`
				} `json:"borrow_token_list"`
				RewardTokenList []struct {
					Symbol string  `json:"symbol"`
					Amount float64 `json:"amount"`
					Price  float64 `json:"price"`
				} `json:"reward_token_list"`
				HealthRate float64 `json:"health_rate"`
			} `json:"detail"`
		} `json:"portfolio_item_list"`
	}

	if err := json.Unmarshal(body, &protocols); err != nil {
		log.Debug().Err(err).Msg("Failed to parse DeBank response")
		return nil
	}

	// Process each protocol's positions
	for _, protocol := range protocols {
		for _, item := range protocol.Portfolio {
			positionType := s.inferPositionType(item.DetailTypes)
			
			var suppliedTokens, borrowedTokens, pendingRewards []model.DeFiToken
			var suppliedUSD, borrowedUSD, rewardsUSD float64

			for _, t := range item.Detail.SupplyTokenList {
				suppliedTokens = append(suppliedTokens, model.DeFiToken{
					Symbol:   t.Symbol,
					Amount:   fmt.Sprintf("%f", t.Amount),
					ValueUSD: t.Amount * t.Price,
				})
				suppliedUSD += t.Amount * t.Price
			}
			for _, t := range item.Detail.BorrowTokenList {
				borrowedTokens = append(borrowedTokens, model.DeFiToken{
					Symbol:   t.Symbol,
					Amount:   fmt.Sprintf("%f", t.Amount),
					ValueUSD: t.Amount * t.Price,
				})
				borrowedUSD += t.Amount * t.Price
			}
			for _, t := range item.Detail.RewardTokenList {
				pendingRewards = append(pendingRewards, model.DeFiToken{
					Symbol:   t.Symbol,
					Amount:   fmt.Sprintf("%f", t.Amount),
					ValueUSD: t.Amount * t.Price,
				})
				rewardsUSD += t.Amount * t.Price
			}

			position := &model.DeFiPosition{
				WalletID:       wallet.ID,
				Protocol:       protocol.Name,
				PositionType:   positionType,
				Network:        wallet.Network,
				SuppliedTokens: suppliedTokens,
				BorrowedTokens: borrowedTokens,
				SuppliedUSD:    suppliedUSD,
				BorrowedUSD:    borrowedUSD,
				PendingRewards: pendingRewards,
				RewardsUSD:     rewardsUSD,
				TotalValueUSD:  item.Stats.NetUSD,
			}

			// Set health factor if available
			if item.Detail.HealthRate > 0 {
				hf := item.Detail.HealthRate
				position.HealthFactor = &hf
				
				// Determine liquidation risk
				if hf < 1.1 {
					position.LiquidationRisk = "critical"
				} else if hf < 1.25 {
					position.LiquidationRisk = "high"
				} else if hf < 1.5 {
					position.LiquidationRisk = "medium"
				} else {
					position.LiquidationRisk = "low"
				}
			}

			// Calculate approximate APY (would need protocol-specific logic for accurate APY)
			position.APY = s.estimateProtocolAPY(protocol.ID, positionType)

			if err := s.db.UpsertDeFiPosition(ctx, position); err != nil {
				log.Error().Err(err).Str("protocol", protocol.Name).Msg("Failed to save DeFi position")
			}
		}
	}

	return nil
}

func (s *CryptoService) inferPositionType(detailTypes []string) string {
	for _, t := range detailTypes {
		switch t {
		case "lending", "supply":
			return "lending"
		case "borrowing", "borrow":
			return "borrowing"
		case "liquidity", "lp":
			return "liquidity"
		case "staking", "stake":
			return "staking"
		case "farming", "farm":
			return "farming"
		case "vault":
			return "vault"
		}
	}
	return "other"
}

func (s *CryptoService) estimateProtocolAPY(protocolID, positionType string) float64 {
	// Approximate APYs by protocol and position type
	// In production, would fetch real-time APY from protocol APIs
	apyEstimates := map[string]map[string]float64{
		"aave":     {"lending": 3.5, "borrowing": -5.0},
		"compound": {"lending": 2.8, "borrowing": -4.5},
		"lido":     {"staking": 4.0},
		"rocket":   {"staking": 4.2},
		"uniswap":  {"liquidity": 15.0},
		"curve":    {"liquidity": 8.0},
		"convex":   {"farming": 12.0},
		"yearn":    {"vault": 6.0},
	}

	if protocolAPYs, ok := apyEstimates[strings.ToLower(protocolID)]; ok {
		if apy, ok := protocolAPYs[positionType]; ok {
			return apy
		}
	}

	// Default estimates by position type
	defaults := map[string]float64{
		"lending":   3.0,
		"borrowing": -5.0,
		"liquidity": 10.0,
		"staking":   4.0,
		"farming":   8.0,
		"vault":     5.0,
	}
	if apy, ok := defaults[positionType]; ok {
		return apy
	}
	return 0
}

// -------------------- Helper Methods --------------------

func (s *CryptoService) isValidAddress(address string, network model.BlockchainNetwork) bool {
	switch network {
	case model.NetworkSolana:
		return len(address) >= 32 && len(address) <= 44
	default: // EVM chains
		return len(address) == 42 && strings.HasPrefix(address, "0x")
	}
}

func (s *CryptoService) getAlchemyURL(network model.BlockchainNetwork) string {
	if s.alchemyAPIKey == "" {
		return ""
	}
	
	baseURLs := map[model.BlockchainNetwork]string{
		model.NetworkEthereum: "https://eth-mainnet.g.alchemy.com/v2/",
		model.NetworkPolygon:  "https://polygon-mainnet.g.alchemy.com/v2/",
		model.NetworkArbitrum: "https://arb-mainnet.g.alchemy.com/v2/",
		model.NetworkOptimism: "https://opt-mainnet.g.alchemy.com/v2/",
		model.NetworkBase:     "https://base-mainnet.g.alchemy.com/v2/",
	}

	if url, ok := baseURLs[network]; ok {
		return url + s.alchemyAPIKey
	}
	return ""
}

func (s *CryptoService) getNativeSymbol(network model.BlockchainNetwork) string {
	symbols := map[model.BlockchainNetwork]string{
		model.NetworkEthereum:  "ETH",
		model.NetworkPolygon:   "MATIC",
		model.NetworkArbitrum:  "ETH",
		model.NetworkOptimism:  "ETH",
		model.NetworkBase:      "ETH",
		model.NetworkBSC:       "BNB",
		model.NetworkAvalanche: "AVAX",
		model.NetworkSolana:    "SOL",
	}
	if sym, ok := symbols[network]; ok {
		return sym
	}
	return "ETH"
}

func (s *CryptoService) hexToFloat(hexStr string, decimals int) float64 {
	// Remove 0x prefix
	cleanHex := strings.TrimPrefix(hexStr, "0x")
	if cleanHex == "" || cleanHex == "0" {
		return 0
	}

	// Parse hex string to big.Int
	value := new(big.Int)
	value.SetString(cleanHex, 16)
	if value.Sign() == 0 {
		return 0
	}

	// Calculate divisor: 10^decimals
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)

	// Convert to float by dividing
	fValue := new(big.Float).SetInt(value)
	fDivisor := new(big.Float).SetInt(divisor)
	result := new(big.Float).Quo(fValue, fDivisor)

	f64, _ := result.Float64()
	return f64
}

func (s *CryptoService) fetchTokenPrice(ctx context.Context, address, network string) (*model.TokenPriceResponse, error) {
	// Handle native tokens
	if address == "native" {
		return s.fetchNativePrice(ctx, network)
	}

	// Map network to CoinGecko platform ID
	platformID := s.getCoinGeckoPlatformID(network)
	if platformID == "" {
		return nil, fmt.Errorf("unsupported network for price lookup: %s", network)
	}

	// CoinGecko API - free tier allows 10-30 calls/minute
	url := fmt.Sprintf(
		"https://api.coingecko.com/api/v3/simple/token_price/%s?contract_addresses=%s&vs_currencies=usd&include_24hr_change=true",
		platformID,
		strings.ToLower(address),
	)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		log.Warn().Msg("CoinGecko rate limit hit")
		return nil, fmt.Errorf("rate limited")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Parse response: {"0x...": {"usd": 1.5, "usd_24h_change": -2.5}}
	var result map[string]struct {
		USD         float64 `json:"usd"`
		USDChange24 float64 `json:"usd_24h_change"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	addrLower := strings.ToLower(address)
	if data, ok := result[addrLower]; ok {
		return &model.TokenPriceResponse{
			Address:   address,
			Price:     data.USD,
			Change24h: data.USDChange24,
			UpdatedAt: time.Now(),
		}, nil
	}

	return nil, fmt.Errorf("token not found on CoinGecko")
}

func (s *CryptoService) fetchNativePrice(ctx context.Context, network string) (*model.TokenPriceResponse, error) {
	// Map network to CoinGecko coin ID
	coinID := s.getNativeCoinGeckoID(network)
	if coinID == "" {
		return nil, fmt.Errorf("unsupported network: %s", network)
	}

	url := fmt.Sprintf(
		"https://api.coingecko.com/api/v3/simple/price?ids=%s&vs_currencies=usd&include_24hr_change=true",
		coinID,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]struct {
		USD         float64 `json:"usd"`
		USDChange24 float64 `json:"usd_24h_change"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	if data, ok := result[coinID]; ok {
		symbol := s.getNativeSymbol(model.BlockchainNetwork(network))
		return &model.TokenPriceResponse{
			Address:   "native",
			Symbol:    symbol,
			Name:      symbol,
			Price:     data.USD,
			Change24h: data.USDChange24,
			UpdatedAt: time.Now(),
		}, nil
	}

	return nil, fmt.Errorf("native token price not found")
}

func (s *CryptoService) getCoinGeckoPlatformID(network string) string {
	platforms := map[string]string{
		"ethereum":  "ethereum",
		"polygon":   "polygon-pos",
		"arbitrum":  "arbitrum-one",
		"optimism":  "optimistic-ethereum",
		"base":      "base",
		"bsc":       "binance-smart-chain",
		"avalanche": "avalanche",
	}
	return platforms[network]
}

func (s *CryptoService) getNativeCoinGeckoID(network string) string {
	coinIDs := map[string]string{
		"ethereum":  "ethereum",
		"polygon":   "matic-network",
		"arbitrum":  "ethereum",
		"optimism":  "ethereum",
		"base":      "ethereum",
		"bsc":       "binancecoin",
		"avalanche": "avalanche-2",
		"solana":    "solana",
	}
	return coinIDs[network]
}

type tokenMetadata struct {
	Symbol   string
	Name     string
	Decimals int
	Logo     string
}

func (s *CryptoService) fetchTokenMetadata(ctx context.Context, address string, network model.BlockchainNetwork) (*tokenMetadata, error) {
	if s.alchemyAPIKey == "" {
		return &tokenMetadata{Symbol: "TOKEN", Name: "Token", Decimals: 18}, nil
	}

	alchemyURL := s.getAlchemyURL(network)
	if alchemyURL == "" {
		return &tokenMetadata{Symbol: "TOKEN", Name: "Token", Decimals: 18}, nil
	}

	payload := fmt.Sprintf(`{
		"jsonrpc": "2.0",
		"method": "alchemy_getTokenMetadata",
		"params": ["%s"],
		"id": 1
	}`, address)

	req, err := http.NewRequestWithContext(ctx, "POST", alchemyURL, strings.NewReader(payload))
	if err != nil {
		return &tokenMetadata{Symbol: "TOKEN", Name: "Token", Decimals: 18}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return &tokenMetadata{Symbol: "TOKEN", Name: "Token", Decimals: 18}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &tokenMetadata{Symbol: "TOKEN", Name: "Token", Decimals: 18}, err
	}

	var result struct {
		Result struct {
			Symbol   string `json:"symbol"`
			Name     string `json:"name"`
			Decimals int    `json:"decimals"`
			Logo     string `json:"logo"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return &tokenMetadata{Symbol: "TOKEN", Name: "Token", Decimals: 18}, err
	}

	return &tokenMetadata{
		Symbol:   result.Result.Symbol,
		Name:     result.Result.Name,
		Decimals: result.Result.Decimals,
		Logo:     result.Result.Logo,
	}, nil
}
