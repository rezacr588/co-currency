package handler

import (
	"net/http"

	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// GetCurrencies handles GET /api/v1/currencies
func (h *Handler) GetCurrencies(w http.ResponseWriter, r *http.Request) {
	currencies, err := h.exchangeService.GetCurrencies(r.Context())
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to fetch currencies", err)
		return
	}

	httputil.Success(w, currencies)
}
