package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// ReportsHandler handles report endpoints
type ReportsHandler struct {
	reportsService *service.ReportsService
}

// NewReportsHandler creates a new ReportsHandler
func NewReportsHandler(reportsService *service.ReportsService) *ReportsHandler {
	return &ReportsHandler{reportsService: reportsService}
}

// GetMonthlyReport handles GET /api/v1/reports/monthly
func (h *ReportsHandler) GetMonthlyReport(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	// Parse optional year and month parameters
	year := time.Now().Year()
	month := int(time.Now().Month())

	if y := r.URL.Query().Get("year"); y != "" {
		if parsed, err := strconv.Atoi(y); err == nil {
			year = parsed
		}
	}
	if m := r.URL.Query().Get("month"); m != "" {
		if parsed, err := strconv.Atoi(m); err == nil && parsed >= 1 && parsed <= 12 {
			month = parsed
		}
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	report, err := h.reportsService.GetMonthlyReport(r.Context(), userID, year, month, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate monthly report")
		return
	}

	httputil.Success(w, report)
}

// GetYearlyReport handles GET /api/v1/reports/yearly
func (h *ReportsHandler) GetYearlyReport(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	year := time.Now().Year()
	if y := r.URL.Query().Get("year"); y != "" {
		if parsed, err := strconv.Atoi(y); err == nil {
			year = parsed
		}
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	report, err := h.reportsService.GetYearlyReport(r.Context(), userID, year, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate yearly report")
		return
	}

	httputil.Success(w, report)
}

// GetDateRangeReport handles GET /api/v1/reports/date-range
func (h *ReportsHandler) GetDateRangeReport(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	fromDate := r.URL.Query().Get("from_date")
	toDate := r.URL.Query().Get("to_date")

	now := time.Now()
	if fromDate == "" {
		fromDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
	}
	if toDate == "" {
		toDate = now.Format("2006-01-02")
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	report, err := h.reportsService.GetDateRangeReport(r.Context(), userID, fromDate, toDate, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate date range report")
		return
	}

	httputil.Success(w, report)
}

// GetCategoryReport handles GET /api/v1/reports/category
func (h *ReportsHandler) GetCategoryReport(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	// Parse date range parameters
	fromDate := r.URL.Query().Get("from_date")
	toDate := r.URL.Query().Get("to_date")

	// Default to current month if not specified
	now := time.Now()
	if fromDate == "" {
		fromDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
	}
	if toDate == "" {
		toDate = now.Format("2006-01-02")
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	report, err := h.reportsService.GetCategoryReport(r.Context(), userID, fromDate, toDate, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate category report")
		return
	}

	httputil.Success(w, report)
}

// GetTrendsReport handles GET /api/v1/reports/trends
func (h *ReportsHandler) GetTrendsReport(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	// Parse months parameter (default to 6 months)
	months := 6
	if m := r.URL.Query().Get("months"); m != "" {
		if parsed, err := strconv.Atoi(m); err == nil && parsed > 0 && parsed <= 24 {
			months = parsed
		}
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	report, err := h.reportsService.GetTrendsReport(r.Context(), userID, months, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate trends report")
		return
	}

	httputil.Success(w, report)
}

// GetNetWorthReport handles GET /api/v1/reports/networth
func (h *ReportsHandler) GetNetWorthReport(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	report, err := h.reportsService.GetNetWorthReport(r.Context(), userID, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate net worth report")
		return
	}

	httputil.Success(w, report)
}

// GetForecast handles GET /api/v1/reports/forecast
func (h *ReportsHandler) GetForecast(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	report, err := h.reportsService.GetForecast(r.Context(), userID, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate forecast report")
		return
	}

	httputil.Success(w, report)
}

// GetInsights handles GET /api/v1/reports/insights
func (h *ReportsHandler) GetInsights(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	insights, err := h.reportsService.GetInsights(r.Context(), userID, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate insights")
		return
	}

	httputil.Success(w, insights)
}

// GetHealthScore handles GET /api/v1/reports/health-score
func (h *ReportsHandler) GetHealthScore(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	healthScore, err := h.reportsService.GetHealthScore(r.Context(), userID, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to calculate health score")
		return
	}

	httputil.Success(w, healthScore)
}

// GetCashFlowProjection handles GET /api/v1/reports/cashflow
func (h *ReportsHandler) GetCashFlowProjection(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	days := 30
	if d := r.URL.Query().Get("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 && parsed <= 90 {
			days = parsed
		}
	}

	report, err := h.reportsService.GetCashFlowProjection(r.Context(), userID, currency, days)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate cash flow projection")
		return
	}

	httputil.Success(w, report)
}

// GetSpendingAnomalies handles GET /api/v1/reports/anomalies
func (h *ReportsHandler) GetSpendingAnomalies(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	report, err := h.reportsService.GetSpendingAnomalies(r.Context(), userID, currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to detect spending anomalies")
		return
	}

	httputil.Success(w, report)
}

// GetWeeklyRecap handles GET /api/v1/reports/weekly-recap
func (h *ReportsHandler) GetWeeklyRecap(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	// Parse optional date parameter for week navigation
	var referenceDate *time.Time
	if dateStr := r.URL.Query().Get("date"); dateStr != "" {
		if parsed, err := time.Parse("2006-01-02", dateStr); err == nil {
			referenceDate = &parsed
		}
	}

	recap, err := h.reportsService.GetWeeklyRecap(r.Context(), userID, currency, referenceDate)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate weekly recap")
		return
	}

	httputil.Success(w, recap)
}
