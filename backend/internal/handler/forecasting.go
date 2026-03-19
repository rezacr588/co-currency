package handler

import (
	"net/http"
	"strconv"

	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// ForecastingHandler handles cash flow forecasting and anomaly detection endpoints
type ForecastingHandler struct {
	forecasterService *service.MLForecasterService
	anomalyService    *service.AnomalyDetectorService
	walletRepo        *repository.WalletRepository
}

// NewForecastingHandler creates a new ForecastingHandler
func NewForecastingHandler(
	forecasterService *service.MLForecasterService,
	anomalyService *service.AnomalyDetectorService,
	walletRepo *repository.WalletRepository,
) *ForecastingHandler {
	return &ForecastingHandler{
		forecasterService: forecasterService,
		anomalyService:    anomalyService,
		walletRepo:        walletRepo,
	}
}

// GetForecast handles GET /api/v1/forecasting/predict
// @Summary Get cash flow forecast
// @Description Get predicted income, expenses, and balance for the next N days
// @Tags forecasting
// @Accept json
// @Produce json
// @Param days query int false "Number of days to forecast (default: 30, max: 90)"
// @Param currency query string false "Currency to forecast (default: USD)"
// @Success 200 {object} service.ForecastResponse
// @Failure 400 {object} httputil.ErrorResponse
// @Failure 401 {object} httputil.ErrorResponse
// @Failure 503 {object} httputil.ErrorResponse
// @Security BearerAuth
// @Router /api/v1/forecasting/predict [get]
func (h *ForecastingHandler) GetForecast(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	// Parse parameters
	days := 30
	if d := r.URL.Query().Get("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 && parsed <= 90 {
			days = parsed
		}
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	// Fetch user's transactions (last 90 days for forecasting)
	transactions, err := h.walletRepo.GetTransactionsForForecasting(r.Context(), userID, 90)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to fetch transactions")
		return
	}

	if len(transactions) < 14 {
		httputil.BadRequestWithContext(r.Context(), w, "insufficient transaction history (need at least 14 days)")
		return
	}

	// Convert to ML service format
	mlTransactions := convertToMLTransactions(transactions)

	// Get forecast from ML service
	forecast, err := h.forecasterService.GetForecast(r.Context(), mlTransactions, days, currency)
	if err != nil {
		httputil.ServiceUnavailableWithContext(r.Context(), w, "forecasting service unavailable")
		return
	}

	httputil.Success(w, forecast)
}

// DetectAnomalies handles GET /api/v1/forecasting/anomalies
// @Summary Detect spending anomalies
// @Description Detect unusual transactions based on historical patterns
// @Tags forecasting
// @Accept json
// @Produce json
// @Param threshold query number false "Z-score threshold for anomaly detection (default: 2.5)"
// @Success 200 {object} service.AnomalyDetectionResponse
// @Failure 400 {object} httputil.ErrorResponse
// @Failure 401 {object} httputil.ErrorResponse
// @Failure 503 {object} httputil.ErrorResponse
// @Security BearerAuth
// @Router /api/v1/forecasting/anomalies [get]
func (h *ForecastingHandler) DetectAnomalies(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	// Parse threshold parameter
	threshold := 2.5
	if t := r.URL.Query().Get("threshold"); t != "" {
		if parsed, err := strconv.ParseFloat(t, 64); err == nil && parsed > 0 && parsed <= 5 {
			threshold = parsed
		}
	}

	// Fetch user's transactions (last 90 days for anomaly detection)
	transactions, err := h.walletRepo.GetTransactionsForForecasting(r.Context(), userID, 90)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to fetch transactions")
		return
	}

	if len(transactions) < 10 {
		httputil.BadRequestWithContext(r.Context(), w, "insufficient transaction history (need at least 10 transactions)")
		return
	}

	// Convert to ML service format
	anomalyTransactions := convertToAnomalyTransactions(transactions)

	// Detect anomalies
	result, err := h.anomalyService.DetectAnomalies(r.Context(), anomalyTransactions, threshold)
	if err != nil {
		httputil.ServiceUnavailableWithContext(r.Context(), w, "anomaly detection service unavailable")
		return
	}

	httputil.Success(w, result)
}

// HealthCheck handles GET /api/v1/forecasting/health
// @Summary Check ML service health
// @Description Check if the ML forecasting service is available
// @Tags forecasting
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 503 {object} httputil.ErrorResponse
// @Router /api/v1/forecasting/health [get]
func (h *ForecastingHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	err := h.forecasterService.HealthCheck(r.Context())
	if err != nil {
		httputil.ServiceUnavailableWithContext(r.Context(), w, "ML service unavailable")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"status":  "healthy",
		"service": "ml-forecasting",
	})
}

// convertToMLTransactions converts wallet transactions to ML forecasting format
func convertToMLTransactions(transactions []repository.TransactionForML) []service.ForecastTransaction {
	result := make([]service.ForecastTransaction, len(transactions))
	for i, t := range transactions {
		result[i] = service.ForecastTransaction{
			Date:     t.CreatedAt.Format("2006-01-02"),
			Type:     t.Type,
			Amount:   t.Amount,
			Category: t.Category,
		}
	}
	return result
}

// convertToAnomalyTransactions converts wallet transactions to anomaly detection format
func convertToAnomalyTransactions(transactions []repository.TransactionForML) []service.AnomalyTransaction {
	result := make([]service.AnomalyTransaction, len(transactions))
	for i, t := range transactions {
		result[i] = service.AnomalyTransaction{
			Date:     t.CreatedAt.Format("2006-01-02"),
			Type:     t.Type,
			Amount:   t.Amount,
			Category: t.Category,
		}
	}
	return result
}
