package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// CryptoHandler handles crypto-related HTTP requests
type CryptoHandler struct {
	cryptoService *service.CryptoService
}

// NewCryptoHandler creates a new CryptoHandler
func NewCryptoHandler(cryptoService *service.CryptoService) *CryptoHandler {
	return &CryptoHandler{
		cryptoService: cryptoService,
	}
}

// -------------------- Wallet Endpoints --------------------

// AddWallet adds a new crypto wallet
// @Summary Add crypto wallet
// @Tags crypto
// @Accept json
// @Produce json
// @Param request body model.AddWalletRequest true "Wallet details"
// @Success 201 {object} model.CryptoWallet
// @Router /api/v1/crypto/wallets [post]
func (h *CryptoHandler) AddWallet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	var req model.AddWalletRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body")
		return
	}

	wallet, err := h.cryptoService.AddWallet(ctx, userID, req)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.Created(w, wallet)
}

// GetWallet retrieves a wallet with balances
// @Summary Get crypto wallet
// @Tags crypto
// @Produce json
// @Param id path string true "Wallet ID"
// @Success 200 {object} model.WalletResponse
// @Router /api/v1/crypto/wallets/{id} [get]
func (h *CryptoHandler) GetWallet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	walletID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid wallet ID")
		return
	}

	response, err := h.cryptoService.GetWallet(ctx, walletID)
	if err != nil {
		httputil.NotFoundWithContext(ctx, w, err.Error())
		return
	}

	// Verify ownership
	if response.Wallet.UserID != userID {
		httputil.NotFoundWithContext(ctx, w, "wallet not found")
		return
	}

	httputil.Success(w, response)
}

// ListWallets lists all wallets for the user
// @Summary List crypto wallets
// @Tags crypto
// @Produce json
// @Success 200 {object} map[string][]model.CryptoWallet
// @Router /api/v1/crypto/wallets [get]
func (h *CryptoHandler) ListWallets(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	wallets, err := h.cryptoService.GetUserWallets(ctx, userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to fetch wallets", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"wallets": wallets,
	})
}

// DeleteWallet removes a wallet
// @Summary Delete crypto wallet
// @Tags crypto
// @Param id path string true "Wallet ID"
// @Success 204
// @Router /api/v1/crypto/wallets/{id} [delete]
func (h *CryptoHandler) DeleteWallet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	walletID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid wallet ID")
		return
	}

	if err := h.cryptoService.DeleteWallet(ctx, userID, walletID); err != nil {
		httputil.NotFoundWithContext(ctx, w, err.Error())
		return
	}

	httputil.NoContent(w)
}

// SyncWallet syncs wallet data from blockchain
// @Summary Sync crypto wallet
// @Tags crypto
// @Param id path string true "Wallet ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/crypto/wallets/{id}/sync [post]
func (h *CryptoHandler) SyncWallet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	walletID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid wallet ID")
		return
	}

	// Verify ownership
	response, err := h.cryptoService.GetWallet(ctx, walletID)
	if err != nil || response.Wallet.UserID != userID {
		httputil.NotFoundWithContext(ctx, w, "wallet not found")
		return
	}

	if err := h.cryptoService.SyncWallet(ctx, walletID); err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to sync wallet", err)
		return
	}

	httputil.Success(w, map[string]string{
		"message": "wallet synced successfully",
	})
}

// -------------------- Portfolio Endpoints --------------------

// GetPortfolioSummary returns portfolio summary
// @Summary Get portfolio summary
// @Tags crypto
// @Produce json
// @Success 200 {object} model.PortfolioSummary
// @Router /api/v1/crypto/portfolio [get]
func (h *CryptoHandler) GetPortfolioSummary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	summary, err := h.cryptoService.GetPortfolioSummary(ctx, userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to fetch portfolio", err)
		return
	}

	httputil.Success(w, summary)
}

// GetDeFiOverview returns DeFi positions overview
// @Summary Get DeFi overview
// @Tags crypto
// @Produce json
// @Success 200 {object} model.DeFiOverview
// @Router /api/v1/crypto/defi [get]
func (h *CryptoHandler) GetDeFiOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	overview, err := h.cryptoService.GetDeFiOverview(ctx, userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to fetch DeFi overview", err)
		return
	}

	httputil.Success(w, overview)
}

// SyncAllWallets syncs all user wallets
// @Summary Sync all wallets
// @Tags crypto
// @Success 200 {object} map[string]string
// @Router /api/v1/crypto/sync [post]
func (h *CryptoHandler) SyncAllWallets(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	if err := h.cryptoService.SyncAllUserWallets(ctx, userID); err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to sync wallets", err)
		return
	}

	httputil.Success(w, map[string]string{
		"message": "all wallets synced successfully",
	})
}

// -------------------- Transaction Endpoints --------------------

// GetWalletTransactions retrieves wallet transactions
// @Summary Get wallet transactions
// @Tags crypto
// @Produce json
// @Param id path string true "Wallet ID"
// @Param type query string false "Transaction type filter"
// @Param token query string false "Token symbol filter"
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/crypto/wallets/{id}/transactions [get]
func (h *CryptoHandler) GetWalletTransactions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	walletID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid wallet ID")
		return
	}

	// Verify ownership
	response, err := h.cryptoService.GetWallet(ctx, walletID)
	if err != nil || response.Wallet.UserID != userID {
		httputil.NotFoundWithContext(ctx, w, "wallet not found")
		return
	}

	filter := model.CryptoTransactionFilter{
		TxType:      r.URL.Query().Get("type"),
		TokenSymbol: r.URL.Query().Get("token"),
	}

	if limit := r.URL.Query().Get("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil {
			filter.Limit = l
		}
	}
	if offset := r.URL.Query().Get("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil {
			filter.Offset = o
		}
	}

	txs, total, err := h.cryptoService.GetWalletTransactions(ctx, walletID, filter)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to fetch transactions", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"transactions": txs,
		"total":        total,
		"limit":        filter.Limit,
		"offset":       filter.Offset,
	})
}

// -------------------- Alert Endpoints --------------------

// CreateAlert creates a price alert
// @Summary Create price alert
// @Tags crypto
// @Accept json
// @Produce json
// @Param request body model.CreateAlertRequest true "Alert details"
// @Success 201 {object} model.CryptoAlert
// @Router /api/v1/crypto/alerts [post]
func (h *CryptoHandler) CreateAlert(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	var req model.CreateAlertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body")
		return
	}

	alert, err := h.cryptoService.CreateAlert(ctx, userID, req)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.Created(w, alert)
}

// ListAlerts lists user's price alerts
// @Summary List price alerts
// @Tags crypto
// @Produce json
// @Param active query bool false "Show only active alerts"
// @Success 200 {object} map[string][]model.CryptoAlert
// @Router /api/v1/crypto/alerts [get]
func (h *CryptoHandler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	activeOnly := r.URL.Query().Get("active") == "true"

	alerts, err := h.cryptoService.GetUserAlerts(ctx, userID, activeOnly)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to fetch alerts", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"alerts": alerts,
	})
}

// DeleteAlert removes an alert
// @Summary Delete price alert
// @Tags crypto
// @Param id path string true "Alert ID"
// @Success 204
// @Router /api/v1/crypto/alerts/{id} [delete]
func (h *CryptoHandler) DeleteAlert(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "authentication required")
		return
	}

	alertID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid alert ID")
		return
	}

	if err := h.cryptoService.DeleteAlert(ctx, userID, alertID); err != nil {
		httputil.NotFoundWithContext(ctx, w, err.Error())
		return
	}

	httputil.NoContent(w)
}

// -------------------- Price Endpoints --------------------

// GetTokenPrice retrieves token price
// @Summary Get token price
// @Tags crypto
// @Produce json
// @Param address query string true "Token address"
// @Param network query string true "Network"
// @Success 200 {object} model.TokenPriceResponse
// @Router /api/v1/crypto/prices [get]
func (h *CryptoHandler) GetTokenPrice(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	address := r.URL.Query().Get("address")
	network := r.URL.Query().Get("network")

	if address == "" || network == "" {
		httputil.BadRequestWithContext(ctx, w, "address and network are required")
		return
	}

	price, err := h.cryptoService.GetTokenPrice(ctx, address, network)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to fetch price", err)
		return
	}

	httputil.Success(w, price)
}

// GetGasPrices retrieves gas prices for a network
// @Summary Get gas prices
// @Tags crypto
// @Produce json
// @Param network query string true "Network"
// @Success 200 {object} model.GasPrice
// @Router /api/v1/crypto/gas [get]
func (h *CryptoHandler) GetGasPrices(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	network := model.BlockchainNetwork(r.URL.Query().Get("network"))
	if network == "" {
		network = model.NetworkEthereum
	}

	gas, err := h.cryptoService.GetGasPrices(ctx, network)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to fetch gas prices", err)
		return
	}

	httputil.Success(w, gas)
}

// GetSupportedNetworks returns list of supported networks
// @Summary Get supported networks
// @Tags crypto
// @Produce json
// @Success 200 {object} map[string][]map[string]string
// @Router /api/v1/crypto/networks [get]
func (h *CryptoHandler) GetSupportedNetworks(w http.ResponseWriter, _ *http.Request) {
	networks := []map[string]string{
		{"id": "ethereum", "name": "Ethereum", "symbol": "ETH"},
		{"id": "polygon", "name": "Polygon", "symbol": "MATIC"},
		{"id": "arbitrum", "name": "Arbitrum", "symbol": "ETH"},
		{"id": "optimism", "name": "Optimism", "symbol": "ETH"},
		{"id": "base", "name": "Base", "symbol": "ETH"},
		{"id": "bsc", "name": "BNB Chain", "symbol": "BNB"},
		{"id": "avalanche", "name": "Avalanche", "symbol": "AVAX"},
		{"id": "solana", "name": "Solana", "symbol": "SOL"},
	}

	httputil.Success(w, map[string]interface{}{
		"networks": networks,
	})
}
