package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// SubscriptionHandler handles subscription endpoints
type SubscriptionHandler struct {
	subscriptionService *service.SubscriptionService
}

// NewSubscriptionHandler creates a new SubscriptionHandler
func NewSubscriptionHandler(subscriptionService *service.SubscriptionService) *SubscriptionHandler {
	return &SubscriptionHandler{subscriptionService: subscriptionService}
}

// GetSubscriptions handles GET /api/v1/subscriptions
// @Summary      List all subscriptions
// @Description  Get a list of all subscriptions for the authenticated user
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "subscriptions: []model.Subscription"
// @Failure      401  {object}  map[string]string       "Unauthorized"
// @Failure      500  {object}  map[string]string       "Internal Server Error"
// @Router       /subscriptions [get]
func (h *SubscriptionHandler) GetSubscriptions(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	subscriptions, err := h.subscriptionService.GetSubscriptions(r.Context(), userID)
	if err != nil {
		httputil.InternalServerError(w, "failed to get subscriptions")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"subscriptions": subscriptions,
	})
}

// GetSubscription handles GET /api/v1/subscriptions/{id}
// @Summary      Get a subscription
// @Description  Get details of a specific subscription by ID
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Subscription ID"
// @Success      200  {object}  model.Subscription
// @Failure      400  {object}  map[string]string  "Invalid ID"
// @Failure      401  {object}  map[string]string  "Unauthorized"
// @Failure      404  {object}  map[string]string  "Subscription not found"
// @Failure      500  {object}  map[string]string  "Internal Server Error"
// @Router       /subscriptions/{id} [get]
func (h *SubscriptionHandler) GetSubscription(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	subscriptionIDStr := chi.URLParam(r, "id")
	subscriptionID, err := uuid.Parse(subscriptionIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid subscription ID")
		return
	}

	subscription, err := h.subscriptionService.GetSubscription(r.Context(), userID, subscriptionID)
	if err != nil {
		if err.Error() == "subscription not found" {
			httputil.NotFound(w, "subscription not found")
			return
		}
		httputil.InternalServerError(w, "failed to get subscription")
		return
	}

	httputil.Success(w, subscription)
}

// CreateSubscription handles POST /api/v1/subscriptions
// @Summary      Create a subscription
// @Description  Create a new subscription
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request  body      model.CreateSubscriptionRequest  true  "Subscription details"
// @Success      201      {object}  model.Subscription
// @Failure      400      {object}  map[string]string  "Invalid request"
// @Failure      401      {object}  map[string]string  "Unauthorized"
// @Failure      500      {object}  map[string]string  "Internal Server Error"
// @Router       /subscriptions [post]
func (h *SubscriptionHandler) CreateSubscription(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	var req model.CreateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	subscription, err := h.subscriptionService.CreateSubscription(r.Context(), userID, &req)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Created(w, subscription)
}

// UpdateSubscription handles PUT /api/v1/subscriptions/{id}
// @Summary      Update a subscription
// @Description  Update details of an existing subscription
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id       path      string                           true  "Subscription ID"
// @Param        request  body      model.UpdateSubscriptionRequest  true  "Update details"
// @Success      200      {object}  model.Subscription
// @Failure      400      {object}  map[string]string  "Invalid request or ID"
// @Failure      401      {object}  map[string]string  "Unauthorized"
// @Failure      404      {object}  map[string]string  "Subscription not found"
// @Failure      500      {object}  map[string]string  "Internal Server Error"
// @Router       /subscriptions/{id} [put]
func (h *SubscriptionHandler) UpdateSubscription(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	subscriptionIDStr := chi.URLParam(r, "id")
	subscriptionID, err := uuid.Parse(subscriptionIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid subscription ID")
		return
	}

	var req model.UpdateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	subscription, err := h.subscriptionService.UpdateSubscription(r.Context(), userID, subscriptionID, &req)
	if err != nil {
		if err.Error() == "subscription not found" {
			httputil.NotFound(w, "subscription not found")
			return
		}
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, subscription)
}

// DeleteSubscription handles DELETE /api/v1/subscriptions/{id}
// @Summary      Delete a subscription
// @Description  Delete a subscription by ID
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Subscription ID"
// @Success      200  {object}  map[string]string  "message: subscription deleted successfully"
// @Failure      400  {object}  map[string]string  "Invalid ID"
// @Failure      401  {object}  map[string]string  "Unauthorized"
// @Failure      404  {object}  map[string]string  "Subscription not found"
// @Failure      500  {object}  map[string]string  "Internal Server Error"
// @Router       /subscriptions/{id} [delete]
func (h *SubscriptionHandler) DeleteSubscription(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	subscriptionIDStr := chi.URLParam(r, "id")
	subscriptionID, err := uuid.Parse(subscriptionIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid subscription ID")
		return
	}

	if err := h.subscriptionService.DeleteSubscription(r.Context(), userID, subscriptionID); err != nil {
		if err.Error() == "subscription not found" {
			httputil.NotFound(w, "subscription not found")
			return
		}
		httputil.InternalServerError(w, "failed to delete subscription")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "subscription deleted successfully",
	})
}

// GetSubscriptionSummary handles GET /api/v1/subscriptions/summary
// @Summary      Get subscription summary
// @Description  Get a summary of subscription costs (monthly/yearly)
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        currency  query     string  false  "Currency code (default: USD)"
// @Success      200       {object}  model.SubscriptionSummary
// @Failure      401       {object}  map[string]string  "Unauthorized"
// @Failure      500       {object}  map[string]string  "Internal Server Error"
// @Router       /subscriptions/summary [get]
func (h *SubscriptionHandler) GetSubscriptionSummary(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "USD"
	}

	summary, err := h.subscriptionService.GetSubscriptionSummary(r.Context(), userID, currency)
	if err != nil {
		httputil.InternalServerError(w, "failed to get subscription summary")
		return
	}

	httputil.Success(w, summary)
}

// GetUpcomingRenewals handles GET /api/v1/subscriptions/upcoming
// @Summary      Get upcoming renewals
// @Description  Get subscriptions renewing in the next N days
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        days  query     int     false  "Number of days to check (default: 7)"
// @Success      200   {object}  map[string]interface{}
// @Failure      401   {object}  map[string]string  "Unauthorized"
// @Failure      500   {object}  map[string]string  "Internal Server Error"
// @Router       /subscriptions/upcoming [get]
func (h *SubscriptionHandler) GetUpcomingRenewals(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	days := 7
	if daysStr := r.URL.Query().Get("days"); daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
			days = d
		}
	}

	renewals, err := h.subscriptionService.GetUpcomingRenewals(r.Context(), userID, days)
	if err != nil {
		httputil.InternalServerError(w, "failed to get upcoming renewals")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"upcoming":    renewals,
		"within_days": days,
	})
}

// GetBillingCycles handles GET /api/v1/subscriptions/billing-cycles
// @Summary      Get billing cycles
// @Description  Get list of supported billing cycles
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200   {object}  map[string]interface{}  "billing_cycles: []string"
// @Router       /subscriptions/billing-cycles [get]
func (h *SubscriptionHandler) GetBillingCycles(w http.ResponseWriter, r *http.Request) {
	httputil.Success(w, map[string]interface{}{
		"billing_cycles": h.subscriptionService.GetBillingCycles(),
	})
}

// GetCategories handles GET /api/v1/subscriptions/categories
// @Summary      Get subscription categories
// @Description  Get list of supported subscription categories
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200   {object}  map[string]interface{}  "categories: []string"
// @Router       /subscriptions/categories [get]
func (h *SubscriptionHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	httputil.Success(w, map[string]interface{}{
		"categories": h.subscriptionService.GetCategories(),
	})
}
