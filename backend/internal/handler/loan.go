package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
)

type LoanHandler struct {
	service *service.LoanService
}

func NewLoanHandler(service *service.LoanService) *LoanHandler {
	return &LoanHandler{service: service}
}

func (h *LoanHandler) CreateLoan(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req model.CreateLoanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Type == "" {
		http.Error(w, "type is required", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	if req.PrincipalAmount <= 0 {
		http.Error(w, "principal_amount must be greater than 0", http.StatusBadRequest)
		return
	}
	if req.Currency == "" {
		http.Error(w, "currency is required", http.StatusBadRequest)
		return
	}
	if req.Type != "borrowed" && req.Type != "lent" {
		http.Error(w, "type must be 'borrowed' or 'lent'", http.StatusBadRequest)
		return
	}

	loan, err := h.service.CreateLoan(r.Context(), userID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"loan": loan})
}

func (h *LoanHandler) GetLoan(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	loanID := chi.URLParam(r, "id")

	loan, err := h.service.GetLoan(r.Context(), loanID, userID)
	if err != nil {
		if err.Error() == "unauthorized" {
			http.Error(w, "Unauthorized", http.StatusForbidden)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if loan == nil {
		http.Error(w, "Loan not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"loan": loan})
}

func (h *LoanHandler) GetAllLoans(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	status := r.URL.Query().Get("status")
	loanType := r.URL.Query().Get("type")

	loans, err := h.service.GetAllLoans(r.Context(), userID, status, loanType)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"loans": loans})
}

func (h *LoanHandler) UpdateLoan(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	loanID := chi.URLParam(r, "id")

	var req model.UpdateLoanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	loan, err := h.service.UpdateLoan(r.Context(), loanID, userID, req)
	if err != nil {
		if err.Error() == "unauthorized" {
			http.Error(w, "Unauthorized", http.StatusForbidden)
			return
		}
		if err.Error() == "loan not found" {
			http.Error(w, "Loan not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"loan": loan})
}

func (h *LoanHandler) DeleteLoan(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	loanID := chi.URLParam(r, "id")

	err := h.service.DeleteLoan(r.Context(), loanID, userID)
	if err != nil {
		if err.Error() == "unauthorized" {
			http.Error(w, "Unauthorized", http.StatusForbidden)
			return
		}
		if err.Error() == "loan not found" {
			http.Error(w, "Loan not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *LoanHandler) MakePayment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	loanID := chi.URLParam(r, "id")

	var req model.CreatePaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Amount <= 0 {
		http.Error(w, "amount must be greater than 0", http.StatusBadRequest)
		return
	}
	if req.PaymentType == "" {
		http.Error(w, "payment_type is required", http.StatusBadRequest)
		return
	}

	payment, err := h.service.MakePayment(r.Context(), loanID, userID, req)
	if err != nil {
		if err.Error() == "unauthorized" {
			http.Error(w, "Unauthorized", http.StatusForbidden)
			return
		}
		if err.Error() == "loan not found" {
			http.Error(w, "Loan not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"payment": payment})
}

func (h *LoanHandler) GetPayments(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	loanID := chi.URLParam(r, "id")

	payments, err := h.service.GetPayments(r.Context(), loanID, userID)
	if err != nil {
		if err.Error() == "unauthorized" {
			http.Error(w, "Unauthorized", http.StatusForbidden)
			return
		}
		if err.Error() == "loan not found" {
			http.Error(w, "Loan not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"payments": payments})
}

func (h *LoanHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	currency := r.URL.Query().Get("currency")

	summary, err := h.service.GetSummary(r.Context(), userID, currency)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (h *LoanHandler) GetUpcoming(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	loans, err := h.service.GetUpcomingDue(r.Context(), userID, 30)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"loans": loans})
}
