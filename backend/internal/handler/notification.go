package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
)

type NotificationHandler struct {
	service *service.NotificationService
}

func NewNotificationHandler(service *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{service: service}
}

// RegisterToken handles POST /notifications/register
func (h *NotificationHandler) RegisterToken(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req model.RegisterTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Token == "" {
		http.Error(w, "token is required", http.StatusBadRequest)
		return
	}
	if req.Platform == "" {
		http.Error(w, "platform is required", http.StatusBadRequest)
		return
	}
	if req.Platform != "ios" && req.Platform != "android" {
		http.Error(w, "platform must be 'ios' or 'android'", http.StatusBadRequest)
		return
	}

	token, err := h.service.RegisterToken(r.Context(), userID, req.Token, req.Platform)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   token,
	})
}

// UnregisterToken handles POST /notifications/unregister
func (h *NotificationHandler) UnregisterToken(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate token
	if req.Token == "" {
		http.Error(w, "token is required", http.StatusBadRequest)
		return
	}

	if err := h.service.UnregisterToken(r.Context(), userID, req.Token); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// GetPreferences handles GET /notifications/preferences
func (h *NotificationHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	prefs, err := h.service.GetPreferences(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"preferences": prefs,
	})
}

// UpdatePreferences handles PUT /notifications/preferences
func (h *NotificationHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req model.UpdatePreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	prefs, err := h.service.UpdatePreferences(r.Context(), userID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"preferences": prefs,
	})
}

// CheckBudgets handles POST /notifications/check-budgets (for manual testing)
func (h *NotificationHandler) CheckBudgets(w http.ResponseWriter, r *http.Request) {
	alertsSent, err := h.service.CheckBudgetAlerts(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"alerts_sent": alertsSent,
	})
}

// CheckLoans handles POST /notifications/check-loans (for manual testing)
func (h *NotificationHandler) CheckLoans(w http.ResponseWriter, r *http.Request) {
	remindersSent, err := h.service.CheckLoanReminders(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"reminders_sent": remindersSent,
	})
}
