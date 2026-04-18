package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
	ws "github.com/rezacr588/currency-converter/internal/websocket"
	"github.com/rezacr588/currency-converter/pkg/httputil"
	"github.com/rs/zerolog/log"
)

// AgentHandler handles autonomous agent API endpoints
type AgentHandler struct {
	planningEngine *service.PlanningEngineService
	actionExecutor *service.ActionExecutor
	autopilot      *service.DailyAutopilotService
	agentRepo      *repository.AgentPlanRepository
	wsPublisher    *ws.Publisher
}

// NewAgentHandler creates a new agent handler. `autopilot` and `agentRepo` are
// optional — they enable the /agent/autopilot/run and /agent/autopilot/result
// endpoints. Pass nil to have those endpoints return 503.
func NewAgentHandler(
	planningEngine *service.PlanningEngineService,
	actionExecutor *service.ActionExecutor,
	autopilot *service.DailyAutopilotService,
	agentRepo *repository.AgentPlanRepository,
	wsPublisher *ws.Publisher,
) *AgentHandler {
	return &AgentHandler{
		planningEngine: planningEngine,
		actionExecutor: actionExecutor,
		autopilot:      autopilot,
		agentRepo:      agentRepo,
		wsPublisher:    wsPublisher,
	}
}

func (h *AgentHandler) publishAgentUpdate(ctx context.Context, userID uuid.UUID, action string, details map[string]interface{}) {
	if h.wsPublisher == nil {
		return
	}
	payload := map[string]interface{}{
		"action":  action,
		"details": details,
	}
	if err := h.wsPublisher.PublishToUser(ctx, userID, ws.MessageTypeAgentUpdate, payload); err != nil {
		log.Warn().Err(err).Str("action", action).Str("user_id", userID.String()).Msg("Failed to publish agent websocket update")
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
	h.publishAgentUpdate(ctx, userID, "plan_created", map[string]interface{}{
		"plan_id": plan.ID.String(),
		"title":   plan.Title,
		"status":  plan.Status,
	})
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
	h.publishAgentUpdate(ctx, userID, "plan_activated", map[string]interface{}{
		"plan_id": planID.String(),
		"status":  "active",
	})
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
	h.publishAgentUpdate(ctx, userID, "plan_paused", map[string]interface{}{
		"plan_id": planID.String(),
		"status":  "paused",
	})
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
	h.publishAgentUpdate(ctx, userID, "plan_resumed", map[string]interface{}{
		"plan_id": planID.String(),
		"status":  "active",
	})
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
	h.publishAgentUpdate(ctx, userID, "plan_cancelled", map[string]interface{}{
		"plan_id": planID.String(),
		"status":  "cancelled",
	})
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
	h.publishAgentUpdate(ctx, userID, "step_approved", map[string]interface{}{
		"plan_id": planID.String(),
		"step_id": stepID.String(),
		"status":  "approved",
	})
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
	h.publishAgentUpdate(ctx, userID, "step_rejected", map[string]interface{}{
		"plan_id": planID.String(),
		"step_id": stepID.String(),
		"status":  "rejected",
	})
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
		// Surface validation errors as 400s so the client gets an actionable
		// message. Everything else is a 500.
		if errors.Is(err, service.ErrInvalidTimezone) || errors.Is(err, service.ErrInvalidAutopilotTime) {
			httputil.BadRequestWithContext(ctx, w, err.Error())
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to update config", err)
		return
	}

	httputil.JSON(w, http.StatusOK, config)
	h.publishAgentUpdate(ctx, userID, "config_updated", map[string]interface{}{
		"enabled":                 config.Enabled,
		"daily_autopilot_enabled": config.DailyAutopilotEnabled,
		"auto_approve_threshold":  config.AutoApproveThreshold,
	})
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
	h.publishAgentUpdate(ctx, userID, "plan_generated", map[string]interface{}{
		"plan_id": plan.ID.String(),
		"title":   plan.Title,
		"status":  plan.Status,
	})
}

// TriggerAutopilot handles POST /api/v1/agent/autopilot/run.
// Runs a daily autopilot scan on-demand for the authenticated user and returns
// the analysis. Side effects (plan creation, notifications) fire asynchronously
// via the scheduler pipeline if the scheduler is running; this endpoint is for
// immediate feedback in the UI.
func (h *AgentHandler) TriggerAutopilot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	if h.autopilot == nil {
		httputil.ServiceUnavailableWithContext(ctx, w, "Autopilot service is not available")
		return
	}

	analysis, err := h.autopilot.RunDailyScan(ctx, userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to run autopilot scan", err)
		return
	}

	// Wrap in { "result": ... } so the response shape matches the existing
	// AutopilotResponse type on the client (app/src/api/agent.ts).
	httputil.JSON(w, http.StatusOK, map[string]interface{}{"result": analysis})
	h.publishAgentUpdate(ctx, userID, "autopilot_run", map[string]interface{}{
		"requires_attention": analysis.RequiresAttention,
		"bills":              len(analysis.UpcomingBills),
		"opportunities":      len(analysis.GoalOpportunities),
		"recommendations":    len(analysis.Recommendations),
	})
}

// GetAutopilotStatus handles GET /api/v1/agent/autopilot/status.
// Returns the consolidated autopilot state for rendering the AutopilotCard
// header: enabled flags, preferred time + timezone, last/next run timestamps,
// pending plan and approval counts.
func (h *AgentHandler) GetAutopilotStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	status, err := h.planningEngine.GetAutopilotStatus(ctx, userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to load autopilot status", err)
		return
	}

	httputil.JSON(w, http.StatusOK, status)
}

// GetAutopilotResult handles GET /api/v1/agent/autopilot/result.
// Returns the most recent persisted daily autopilot result for the user.
// Returns 404 if the user has never run an autopilot scan.
func (h *AgentHandler) GetAutopilotResult(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "User not authenticated")
		return
	}

	if h.agentRepo == nil {
		httputil.ServiceUnavailableWithContext(ctx, w, "Autopilot storage is not available")
		return
	}

	result, err := h.agentRepo.GetLatestAutopilotResult(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.NotFoundWithContext(ctx, w, "No autopilot runs yet — trigger one to generate results")
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "Failed to fetch autopilot result", err)
		return
	}

	// Wrap to match AutopilotResponse on the client.
	httputil.JSON(w, http.StatusOK, map[string]interface{}{"result": result})
}
