package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// GetRates handles GET /api/v1/rates/:base
func (h *Handler) GetRates(w http.ResponseWriter, r *http.Request) {
	base := chi.URLParam(r, "base")
	if base == "" {
		base = "USD"
	}

	rates, err := h.exchangeService.GetLatestRates(r.Context(), base)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to fetch rates", err)
		return
	}

	httputil.Success(w, rates)
}
