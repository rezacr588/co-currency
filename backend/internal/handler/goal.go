package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// GoalHandler handles goal endpoints
type GoalHandler struct {
	goalService *service.GoalService
}

// NewGoalHandler creates a new GoalHandler
func NewGoalHandler(goalService *service.GoalService) *GoalHandler {
	return &GoalHandler{goalService: goalService}
}

// GetGoals handles GET /api/v1/goals
func (h *GoalHandler) GetGoals(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	goals, err := h.goalService.GetGoals(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get goals")
		return
	}

	// Add progress to response
	type goalWithProgress struct {
		model.Goal
		Progress    float64 `json:"progress"`
		IsCompleted bool    `json:"is_completed"`
	}

	goalsWithProgress := make([]goalWithProgress, len(goals))
	for i, g := range goals {
		goalsWithProgress[i] = goalWithProgress{
			Goal:        g,
			Progress:    g.Progress(),
			IsCompleted: g.IsCompleted(),
		}
	}

	httputil.Success(w, map[string]interface{}{
		"goals": goalsWithProgress,
	})
}

// GetGoal handles GET /api/v1/goals/{id}
func (h *GoalHandler) GetGoal(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	goalID, ok := parseUUIDParam(w, r, "id", "goal")
	if !ok {
		return
	}

	goal, err := h.goalService.GetGoal(r.Context(), userID, goalID)
	if err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "goal not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get goal")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"goal":         goal,
		"progress":     goal.Progress(),
		"is_completed": goal.IsCompleted(),
	})
}

// CreateGoal handles POST /api/v1/goals
func (h *GoalHandler) CreateGoal(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	req, ok := decodeJSON[model.CreateGoalRequest](w, r)
	if !ok {
		return
	}

	goal, err := h.goalService.CreateGoal(r.Context(), userID, req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidGoalType) || errors.Is(err, service.ErrInvalidGoalWorkflowStatus) || isGoalValidationError(err) {
			httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to create goal", err)
		return
	}

	httputil.Created(w, map[string]interface{}{
		"goal":         goal,
		"progress":     goal.Progress(),
		"is_completed": goal.IsCompleted(),
	})
}

// UpdateGoal handles PUT /api/v1/goals/{id}
func (h *GoalHandler) UpdateGoal(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	goalID, ok := parseUUIDParam(w, r, "id", "goal")
	if !ok {
		return
	}

	req, ok := decodeJSON[model.UpdateGoalRequest](w, r)
	if !ok {
		return
	}

	goal, err := h.goalService.UpdateGoal(r.Context(), userID, goalID, req)
	if err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "goal not found")
			return
		}
		if errors.Is(err, service.ErrInvalidGoalType) || errors.Is(err, service.ErrInvalidGoalWorkflowStatus) || isGoalValidationError(err) {
			httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to update goal", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"goal":         goal,
		"progress":     goal.Progress(),
		"is_completed": goal.IsCompleted(),
	})
}

// DeleteGoal handles DELETE /api/v1/goals/{id}
func (h *GoalHandler) DeleteGoal(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	goalID, ok := parseUUIDParam(w, r, "id", "goal")
	if !ok {
		return
	}

	if err := h.goalService.DeleteGoal(r.Context(), userID, goalID); err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "goal not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to delete goal")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "goal deleted successfully",
	})
}

// ContributeToGoal handles POST /api/v1/goals/{id}/contribute
func (h *GoalHandler) ContributeToGoal(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	goalID, ok := parseUUIDParam(w, r, "id", "goal")
	if !ok {
		return
	}

	req, ok := decodeJSON[model.ContributeToGoalRequest](w, r)
	if !ok {
		return
	}

	goal, transaction, err := h.goalService.ContributeToGoal(r.Context(), userID, goalID, req)
	if err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "goal not found")
			return
		}
		if errors.Is(err, repository.ErrInsufficientBalance) {
			httputil.BadRequest(w, "insufficient balance")
			return
		}
		if errors.Is(err, service.ErrGoalContributionNotAllowed) || isGoalValidationError(err) {
			httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, "failed to contribute to goal")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"goal":         goal,
		"progress":     goal.Progress(),
		"is_completed": goal.IsCompleted(),
		"transaction":  transaction,
	})
}

// GetGoalCategories handles GET /api/v1/goals/categories
func (h *GoalHandler) GetGoalCategories(w http.ResponseWriter, r *http.Request) {
	httputil.Success(w, map[string]interface{}{
		"categories": model.GoalCategories,
	})
}

// GetGoalTypes handles GET /api/v1/goals/types
func (h *GoalHandler) GetGoalTypes(w http.ResponseWriter, r *http.Request) {
	httputil.Success(w, map[string]interface{}{
		"types": model.GoalTypes,
	})
}

func isGoalValidationError(err error) bool {
	msg := err.Error()
	for _, marker := range []string{
		"name is required",
		"name cannot be empty",
		"target_amount must be positive",
		"currency is required",
		"invalid deadline format",
		"amount must be positive",
		"invalid goal workflow status",
	} {
		if strings.Contains(msg, marker) {
			return true
		}
	}
	return false
}
