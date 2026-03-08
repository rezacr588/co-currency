package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

type NotificationHandler struct {
	service *service.NotificationService
}

func NewNotificationHandler(service *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{service: service}
}

// RegisterToken handles POST /notifications/register
func (h *NotificationHandler) RegisterToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.RegisterTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	// Validate required fields
	if req.Token == "" {
		httputil.BadRequestWithContext(r.Context(), w, "token is required", nil)
		return
	}
	if req.Platform == "" {
		httputil.BadRequestWithContext(r.Context(), w, "platform is required", nil)
		return
	}
	if req.Platform != "ios" && req.Platform != "android" {
		httputil.BadRequestWithContext(r.Context(), w, "platform must be 'ios' or 'android'", nil)
		return
	}

	token, err := h.service.RegisterToken(r.Context(), userID.String(), req.Token, req.Platform)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to register token")
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
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	// Validate token
	if req.Token == "" {
		httputil.BadRequestWithContext(r.Context(), w, "token is required", nil)
		return
	}

	if err := h.service.UnregisterToken(r.Context(), userID.String(), req.Token); err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to unregister token")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// GetPreferences handles GET /notifications/preferences
func (h *NotificationHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	prefs, err := h.service.GetPreferences(r.Context(), userID.String())
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get preferences")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"preferences": prefs,
	})
}

// UpdatePreferences handles PUT /notifications/preferences
func (h *NotificationHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.UpdatePreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	prefs, err := h.service.UpdatePreferences(r.Context(), userID.String(), req)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to update preferences")
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
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to check budget alerts")
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
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to check loan reminders")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"reminders_sent": remindersSent,
	})
}
