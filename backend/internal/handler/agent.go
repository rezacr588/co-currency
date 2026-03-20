package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// AgentHandler handles autonomous agent API endpoints
type AgentHandler struct {
	planningEngine *service.PlanningEngineService
	actionExecutor *service.ActionExecutor
}

// NewAgentHandler creates a new agent handler
func NewAgentHandler(planningEngine *service.PlanningEngineService, actionExecutor *service.ActionExecutor) *AgentHandler {
	return &AgentHandler{
		planningEngine: planningEngine,
		actionExecutor: actionExecutor,
	}
}

// ListPlans handles GET /api/v1/agent/plans
func (h *AgentHandler) ListPlans(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	// Parse query params
	status := r.URL.Query().Get("status")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	plans, total, err := h.planningEngine.ListPlans(ctx, userID, status, limit, offset)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to list plans", err)
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]interface{}{
		"plans":  plans,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetPlan handles GET /api/v1/agent/plans/{id}
func (h *AgentHandler) GetPlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	planIDStr := chi.URLParam(r, "id")
	planID, err := uuid.Parse(planIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid plan ID")
		return
	}

	plan, err := h.planningEngine.GetPlan(ctx, userID, planID)
	if err != nil {
		if errors.Is(err, service.ErrPlanNotFound) {
			httputil.NotFoundWithContext(ctx, w, "Plan not found")
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to get plan", err)
		return
	}

	httputil.JSON(w, http.StatusOK, plan)
}

// CreatePlan handles POST /api/v1/agent/plans
func (h *AgentHandler) CreatePlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	var req model.CreatePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Title == "" {
		httputil.BadRequestWithContext(ctx, w, "Title is required")
		return
	}
	if req.GoalType == "" {
		httputil.BadRequestWithContext(ctx, w, "Goal type is required")
		return
	}

	plan, err := h.planningEngine.CreatePlan(ctx, userID, &req)
	if err != nil {
		if errors.Is(err, service.ErrMaxActivePlans) {
			httputil.BadRequestWithContext(ctx, w, "Maximum active plans limit reached")
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to create plan", err)
		return
	}

	httputil.JSON(w, http.StatusCreated, plan)
}

// ActivatePlan handles POST /api/v1/agent/plans/{id}/activate
func (h *AgentHandler) ActivatePlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	planIDStr := chi.URLParam(r, "id")
	planID, err := uuid.Parse(planIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid plan ID")
		return
	}

	if err := h.planningEngine.ActivatePlan(ctx, userID, planID); err != nil {
		if errors.Is(err, service.ErrPlanNotFound) {
			httputil.NotFoundWithContext(ctx, w, "Plan not found")
			return
		}
		if errors.Is(err, service.ErrInvalidPlanStatus) {
			httputil.BadRequestWithContext(ctx, w, "Plan cannot be activated from current status")
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to activate plan", err)
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"status": "activated"})
}

// PausePlan handles POST /api/v1/agent/plans/{id}/pause
func (h *AgentHandler) PausePlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	planIDStr := chi.URLParam(r, "id")
	planID, err := uuid.Parse(planIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid plan ID")
		return
	}

	if err := h.planningEngine.PausePlan(ctx, userID, planID); err != nil {
		if errors.Is(err, service.ErrPlanNotFound) {
			httputil.NotFoundWithContext(ctx, w, "Plan not found")
			return
		}
		if errors.Is(err, service.ErrInvalidPlanStatus) {
			httputil.BadRequestWithContext(ctx, w, "Plan cannot be paused from current status")
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to pause plan", err)
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"status": "paused"})
}

// ResumePlan handles POST /api/v1/agent/plans/{id}/resume
func (h *AgentHandler) ResumePlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	planIDStr := chi.URLParam(r, "id")
	planID, err := uuid.Parse(planIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid plan ID")
		return
	}

	if err := h.planningEngine.ResumePlan(ctx, userID, planID); err != nil {
		if errors.Is(err, service.ErrPlanNotFound) {
			httputil.NotFoundWithContext(ctx, w, "Plan not found")
			return
		}
		if errors.Is(err, service.ErrInvalidPlanStatus) {
			httputil.BadRequestWithContext(ctx, w, "Plan cannot be resumed from current status")
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to resume plan", err)
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"status": "active"})
}

// CancelPlan handles DELETE /api/v1/agent/plans/{id}
func (h *AgentHandler) CancelPlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	planIDStr := chi.URLParam(r, "id")
	planID, err := uuid.Parse(planIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid plan ID")
		return
	}

	if err := h.planningEngine.CancelPlan(ctx, userID, planID); err != nil {
		if errors.Is(err, service.ErrPlanNotFound) {
			httputil.NotFoundWithContext(ctx, w, "Plan not found")
			return
		}
		if errors.Is(err, service.ErrInvalidPlanStatus) {
			httputil.BadRequestWithContext(ctx, w, "Plan cannot be cancelled")
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to cancel plan", err)
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

// ApproveStep handles POST /api/v1/agent/plans/{id}/steps/{stepId}/approve
func (h *AgentHandler) ApproveStep(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	planIDStr := chi.URLParam(r, "id")
	planID, err := uuid.Parse(planIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid plan ID")
		return
	}

	stepIDStr := chi.URLParam(r, "stepId")
	stepID, err := uuid.Parse(stepIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid step ID")
		return
	}

	var req model.ApproveActionRequest
	if r.ContentLength > 0 {
		json.NewDecoder(r.Body).Decode(&req)
	}

	method := req.Method
	if method == "" {
		method = "manual"
	}

	if err := h.planningEngine.ApproveStep(ctx, userID, planID, stepID, method, req.DeviceInfo); err != nil {
		if errors.Is(err, service.ErrPlanNotFound) || errors.Is(err, service.ErrStepNotFound) {
			httputil.NotFoundWithContext(ctx, w, "Plan or step not found")
			return
		}
		if errors.Is(err, service.ErrStepNotPending) {
			httputil.BadRequestWithContext(ctx, w, "Step is not pending approval")
			return
		}
		if errors.Is(err, service.ErrApprovalNotFound) {
			httputil.NotFoundWithContext(ctx, w, "Approval not found")
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to approve step", err)
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"status": "approved"})
}

// RejectStep handles POST /api/v1/agent/plans/{id}/steps/{stepId}/reject
func (h *AgentHandler) RejectStep(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	planIDStr := chi.URLParam(r, "id")
	planID, err := uuid.Parse(planIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid plan ID")
		return
	}

	stepIDStr := chi.URLParam(r, "stepId")
	stepID, err := uuid.Parse(stepIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid step ID")
		return
	}

	var req model.RejectActionRequest
	if r.ContentLength > 0 {
		json.NewDecoder(r.Body).Decode(&req)
	}

	if err := h.planningEngine.RejectStep(ctx, userID, planID, stepID, req.Reason); err != nil {
		if errors.Is(err, service.ErrPlanNotFound) || errors.Is(err, service.ErrStepNotFound) {
			httputil.NotFoundWithContext(ctx, w, "Plan or step not found")
			return
		}
		if errors.Is(err, service.ErrStepNotPending) {
			httputil.BadRequestWithContext(ctx, w, "Step is not pending approval")
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to reject step", err)
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"status": "rejected"})
}

// GetPendingApprovals handles GET /api/v1/agent/approvals/pending
func (h *AgentHandler) GetPendingApprovals(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	approvals, err := h.planningEngine.GetPendingApprovals(ctx, userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to get pending approvals", err)
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]interface{}{
		"approvals": approvals,
		"count":     len(approvals),
	})
}

// GetConfig handles GET /api/v1/agent/config
func (h *AgentHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	config, err := h.planningEngine.GetConfig(ctx, userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to get config", err)
		return
	}

	httputil.JSON(w, http.StatusOK, config)
}

// UpdateConfig handles POST /api/v1/agent/config
func (h *AgentHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	var req model.UpdateConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid request body")
		return
	}

	config, err := h.planningEngine.UpdateConfig(ctx, userID, &req)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to update config", err)
		return
	}

	httputil.JSON(w, http.StatusOK, config)
}

// GetActionLogs handles GET /api/v1/agent/logs
func (h *AgentHandler) GetActionLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	logs, total, err := h.planningEngine.GetActionLogs(ctx, userID, limit, offset)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to get action logs", err)
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]interface{}{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetDailyBriefing handles GET /api/v1/agent/briefing
func (h *AgentHandler) GetDailyBriefing(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	briefing, err := h.planningEngine.GetDailyBriefing(ctx, userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to get daily briefing", err)
		return
	}

	httputil.JSON(w, http.StatusOK, briefing)
}

// GenerateAIPlan handles POST /api/v1/agent/plans/generate
func (h *AgentHandler) GenerateAIPlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	var req struct {
		GoalType     string  `json:"goal_type"`
		TargetAmount float64 `json:"target_amount"`
		Currency     string  `json:"currency"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "Invalid request body")
		return
	}

	if req.GoalType == "" {
		httputil.BadRequestWithContext(ctx, w, "Goal type is required")
		return
	}
	if req.Currency == "" {
		req.Currency = "USD"
	}

	plan, err := h.planningEngine.GeneratePlanWithAI(ctx, userID, req.GoalType, req.TargetAmount, req.Currency)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to generate AI plan", err)
		return
	}

	httputil.JSON(w, http.StatusCreated, plan)
}
