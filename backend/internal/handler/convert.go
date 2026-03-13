package handler

import (
	"net/http"
	"strconv"

	"github.com/rezacr588/currency-converter/pkg/httputil"
	"github.com/rs/zerolog/log"
)

// Convert handles GET /api/v1/convert
func (h *Handler) Convert(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	amountStr := r.URL.Query().Get("amount")

	if from == "" || to == "" || amountStr == "" {
		httputil.BadRequestWithContext(r.Context(), w, "missing required parameters: from, to, amount")
		return
	}

	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil || amount < 0 {
		httputil.BadRequestWithContext(r.Context(), w, "invalid amount value")
		return
	}

	result, err := h.exchangeService.Convert(r.Context(), from, to, amount)
	if err != nil {
		log.Error().Err(err).
			Str("from", from).
			Str("to", to).
			Float64("amount", amount).
			Msg("Currency conversion failed")
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to convert currency", err)
		return
	}

	httputil.Success(w, result)
}
