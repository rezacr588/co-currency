package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

type LoanHandler struct {
	service *service.LoanService
}

func NewLoanHandler(service *service.LoanService) *LoanHandler {
	return &LoanHandler{service: service}
}

func (h *LoanHandler) CreateLoan(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.CreateLoanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	// Validate required fields
	if req.Type == "" {
		httputil.BadRequestWithContext(r.Context(), w, "type is required", nil)
		return
	}
	if req.Name == "" {
		httputil.BadRequestWithContext(r.Context(), w, "name is required", nil)
		return
	}
	if req.PrincipalAmount <= 0 {
		httputil.BadRequestWithContext(r.Context(), w, "principal_amount must be greater than 0", nil)
		return
	}
	if req.Currency == "" {
		httputil.BadRequestWithContext(r.Context(), w, "currency is required", nil)
		return
	}
	if req.Type != "borrowed" && req.Type != "lent" {
		httputil.BadRequestWithContext(r.Context(), w, "type must be 'borrowed' or 'lent'", nil)
		return
	}

	loan, err := h.service.CreateLoan(r.Context(), userID.String(), req)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to create loan")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"loan": loan})
}

func (h *LoanHandler) GetLoan(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	loanID := chi.URLParam(r, "id")

	loan, err := h.service.GetLoan(r.Context(), loanID, userID.String())
	if err != nil {
		if err.Error() == "unauthorized" {
			httputil.UnauthorizedWithContext(r.Context(), w, "unauthorized")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get loan")
		return
	}
	if loan == nil {
		httputil.NotFoundWithContext(r.Context(), w, "loan not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"loan": loan})
}

func (h *LoanHandler) GetAllLoans(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	status := r.URL.Query().Get("status")
	loanType := r.URL.Query().Get("type")

	loans, err := h.service.GetAllLoans(r.Context(), userID.String(), status, loanType)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get loans")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"loans": loans})
}

func (h *LoanHandler) UpdateLoan(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	loanID := chi.URLParam(r, "id")

	var req model.UpdateLoanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	loan, err := h.service.UpdateLoan(r.Context(), loanID, userID.String(), req)
	if err != nil {
		if err.Error() == "unauthorized" {
			httputil.UnauthorizedWithContext(r.Context(), w, "unauthorized")
			return
		}
		if err.Error() == "loan not found" {
			httputil.NotFoundWithContext(r.Context(), w, "loan not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to update loan")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"loan": loan})
}

func (h *LoanHandler) DeleteLoan(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	loanID := chi.URLParam(r, "id")

	err := h.service.DeleteLoan(r.Context(), loanID, userID.String())
	if err != nil {
		if err.Error() == "unauthorized" {
			httputil.UnauthorizedWithContext(r.Context(), w, "unauthorized")
			return
		}
		if err.Error() == "loan not found" {
			httputil.NotFoundWithContext(r.Context(), w, "loan not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to delete loan")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *LoanHandler) MakePayment(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	loanID := chi.URLParam(r, "id")

	var req model.CreatePaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	// Validate required fields
	if req.Amount <= 0 {
		httputil.BadRequestWithContext(r.Context(), w, "amount must be greater than 0", nil)
		return
	}
	if req.PaymentType == "" {
		httputil.BadRequestWithContext(r.Context(), w, "payment_type is required", nil)
		return
	}

	payment, err := h.service.MakePayment(r.Context(), loanID, userID.String(), req)
	if err != nil {
		if err.Error() == "unauthorized" {
			httputil.UnauthorizedWithContext(r.Context(), w, "unauthorized")
			return
		}
		if err.Error() == "loan not found" {
			httputil.NotFoundWithContext(r.Context(), w, "loan not found")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, err.Error(), nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"payment": payment})
}

func (h *LoanHandler) GetPayments(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	loanID := chi.URLParam(r, "id")

	payments, err := h.service.GetPayments(r.Context(), loanID, userID.String())
	if err != nil {
		if err.Error() == "unauthorized" {
			httputil.UnauthorizedWithContext(r.Context(), w, "unauthorized")
			return
		}
		if err.Error() == "loan not found" {
			httputil.NotFoundWithContext(r.Context(), w, "loan not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get payments")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"payments": payments})
}

func (h *LoanHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	currency := r.URL.Query().Get("currency")

	summary, err := h.service.GetSummary(r.Context(), userID.String(), currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get loan summary")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (h *LoanHandler) GetUpcoming(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	loans, err := h.service.GetUpcomingDue(r.Context(), userID.String(), 30)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get upcoming loans")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"loans": loans})
}
