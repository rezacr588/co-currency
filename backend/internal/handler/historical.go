package handler

import (
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

var dateRegex = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// GetHistorical handles GET /api/v1/historical/:date
func (h *Handler) GetHistorical(w http.ResponseWriter, r *http.Request) {
	date := chi.URLParam(r, "date")
	if date == "" || !dateRegex.MatchString(date) {
		httputil.BadRequest(w, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	base := r.URL.Query().Get("base")
	if base == "" {
		base = "USD"
	}

	rates, err := h.exchange.GetHistoricalRates(r.Context(), date, base)
	if err != nil {
		httputil.InternalServerError(w, "Failed to fetch historical rates")
		return
	}

	httputil.Success(w, rates)
}
