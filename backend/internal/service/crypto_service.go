package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	// Simplified - would call network-specific RPC
	return &model.GasPrice{
		Network:   network,
		Slow:      20,
		Standard:  30,
		Fast:      50,
		Instant:   80,
		BaseFee:   15,
		UpdatedAt: time.Now(),
	}, nil
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

		s.db.UpsertBalance(ctx, balance)
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

	body, _ := io.ReadAll(resp.Body)

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

	body, _ := io.ReadAll(resp.Body)

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

		s.db.CreateTransaction(ctx, tx)
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

	body, _ := io.ReadAll(resp.Body)

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

		s.db.UpsertNFT(ctx, nft)
	}

	return nil
}

func (s *CryptoService) syncDeFiPositions(ctx context.Context, wallet *model.CryptoWallet) error {
	// Would integrate with DeFi APIs like Zapper, DeBank, etc.
	// Simplified for now
	log.Debug().Str("wallet", wallet.Address).Msg("DeFi position sync not fully implemented")
	return nil
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
	// Simplified hex to float conversion
	// In production, use big.Int for precision
	return 0
}

func (s *CryptoService) fetchTokenPrice(ctx context.Context, address, network string) (*model.TokenPriceResponse, error) {
	// Would call CoinGecko, CoinMarketCap, or similar
	// Simplified response
	return &model.TokenPriceResponse{
		Address:   address,
		Symbol:    "TOKEN",
		Name:      "Token",
		Price:     1.0,
		Change24h: 0,
		UpdatedAt: time.Now(),
	}, nil
}

type tokenMetadata struct {
	Symbol   string
	Name     string
	Decimals int
	Logo     string
}

func (s *CryptoService) fetchTokenMetadata(ctx context.Context, address string, network model.BlockchainNetwork) (*tokenMetadata, error) {
	// Would call Alchemy getTokenMetadata
	return &tokenMetadata{
		Symbol:   "TOKEN",
		Name:     "Token",
		Decimals: 18,
	}, nil
}
