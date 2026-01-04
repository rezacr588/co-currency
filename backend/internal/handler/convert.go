package handler

import (
	"net/http"
	"strconv"

	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// Convert handles GET /api/v1/convert
func (h *Handler) Convert(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	amountStr := r.URL.Query().Get("amount")

	if from == "" || to == "" || amountStr == "" {
		httputil.BadRequest(w, "Missing required parameters: from, to, amount")
		return
	}

	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil || amount < 0 {
		httputil.BadRequest(w, "Invalid amount value")
		return
	}

	result, err := h.exchange.Convert(r.Context(), from, to, amount)
	if err != nil {
		httputil.InternalServerError(w, "Failed to convert currency")
		return
	}

	httputil.Success(w, result)
}
