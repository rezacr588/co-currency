package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// WealthHandler handles wealth/purchasing power endpoints
type WealthHandler struct {
	wealthService *service.WealthService
}

// NewWealthHandler creates a new WealthHandler
func NewWealthHandler(wealthService *service.WealthService) *WealthHandler {
	return &WealthHandler{wealthService: wealthService}
}

// GetOverview handles GET /api/v1/wealth/overview
func (h *WealthHandler) GetOverview(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	overview, err := h.wealthService.GetOverview(r.Context(), userID, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get wealth overview")
		return
	}

	httputil.Success(w, overview)
}

// GetHistory handles GET /api/v1/wealth/history
func (h *WealthHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	months := 6
	if m := r.URL.Query().Get("months"); m != "" {
		if parsed, err := strconv.Atoi(m); err == nil && parsed > 0 && parsed <= 24 {
			months = parsed
		}
	}

	history, err := h.wealthService.GetHistory(r.Context(), userID, currency, months)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get wealth history")
		return
	}

	httputil.Success(w, history)
}

// GetWhatIf handles GET /api/v1/wealth/what-if
func (h *WealthHandler) GetWhatIf(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	_ = userID // used for auth context

	fromCurrency := r.URL.Query().Get("from")
	toCurrency := r.URL.Query().Get("to")
	if fromCurrency == "" || toCurrency == "" {
		httputil.BadRequestWithContext(r.Context(), w, "from and to currency parameters are required")
		return
	}

	if _, ok := model.CurrencyList[fromCurrency]; !ok {
		httputil.BadRequestWithContext(r.Context(), w, "invalid from currency code")
		return
	}
	if _, ok := model.CurrencyList[toCurrency]; !ok {
		httputil.BadRequestWithContext(r.Context(), w, "invalid to currency code")
		return
	}

	amountStr := r.URL.Query().Get("amount")
	amount := 0.0
	if amountStr != "" {
		var err error
		amount, err = strconv.ParseFloat(amountStr, 64)
		if err != nil || amount <= 0 {
			httputil.BadRequestWithContext(r.Context(), w, "amount must be a positive number")
			return
		}
	} else {
		httputil.BadRequestWithContext(r.Context(), w, "amount parameter is required")
		return
	}

	monthsAgo := 3
	if m := r.URL.Query().Get("months_ago"); m != "" {
		if parsed, err := strconv.Atoi(m); err == nil && parsed > 0 {
			monthsAgo = parsed
		}
	}

	result, err := h.wealthService.GetWhatIf(r.Context(), userID, fromCurrency, toCurrency, amount, monthsAgo)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to run what-if analysis")
		return
	}

	httputil.Success(w, result)
}

// GetAlerts handles GET /api/v1/wealth/alerts
func (h *WealthHandler) GetAlerts(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	alerts, err := h.wealthService.GetAlerts(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get wealth alerts")
		return
	}

	result := alerts
	if result == nil {
		result = []model.WealthAlert{}
	}

	httputil.Success(w, map[string]interface{}{
		"alerts": result,
	})
}

// MarkAlertRead handles POST /api/v1/wealth/alerts/{id}/read
func (h *WealthHandler) MarkAlertRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	alertIDStr := chi.URLParam(r, "id")
	alertID, err := uuid.Parse(alertIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid alert ID")
		return
	}

	if err := h.wealthService.MarkAlertRead(r.Context(), alertID, userID); err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to mark alert as read")
		return
	}

	httputil.Success(w, map[string]bool{"success": true})
}
