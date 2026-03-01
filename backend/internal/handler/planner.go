package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

type PlannerHandler struct {
	plannerService *service.PlannerService
}

func NewPlannerHandler(plannerService *service.PlannerService) *PlannerHandler {
	return &PlannerHandler{plannerService: plannerService}
}

// GetBoard handles GET /api/v1/planner/board.
func (h *PlannerHandler) GetBoard(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	board, err := h.plannerService.GetBoard(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get planner board", err)
		return
	}
	httputil.Success(w, board)
}

// MoveItem handles PATCH /api/v1/planner/items/{type}/{id}/move.
func (h *PlannerHandler) MoveItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	itemType := strings.TrimSpace(chi.URLParam(r, "type"))
	itemID, ok := parseUUIDParam(w, r, "id", "item")
	if !ok {
		return
	}
	req, ok := decodeJSON[model.MovePlannerItemRequest](w, r)
	if !ok {
		return
	}
	item, err := h.plannerService.MoveItem(r.Context(), userID, itemType, itemID, req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidPlannerItemType) || errors.Is(err, service.ErrInvalidTodoStatus) {
			httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
			return
		}
		if errors.Is(err, repository.ErrTaskNotFound) || errors.Is(err, repository.ErrGoalNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "planner item not found", err)
			return
		}
		var fundingErr *service.GoalFundingRequiredError
		if errors.As(err, &fundingErr) {
			httputil.JSON(w, http.StatusConflict, model.GoalFundingRequired{
				GoalID:    fundingErr.GoalID,
				Remaining: fundingErr.Remaining,
				Currency:  fundingErr.Currency,
				Message:   "goal funding required before marking done",
				ErrorCode: "goal_funding_required",
			})
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
		return
	}
	httputil.Success(w, map[string]interface{}{"item": item})
}

// MarkGoalDone handles POST /api/v1/planner/goals/{id}/mark-done.
func (h *PlannerHandler) MarkGoalDone(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	goalID, ok := parseUUIDParam(w, r, "id", "goal")
	if !ok {
		return
	}
	goal, err := h.plannerService.MarkGoalDone(r.Context(), userID, goalID)
	if err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "goal not found", err)
			return
		}
		var fundingErr *service.GoalFundingRequiredError
		if errors.As(err, &fundingErr) {
			httputil.JSON(w, http.StatusConflict, model.GoalFundingRequired{
				GoalID:    fundingErr.GoalID,
				Remaining: fundingErr.Remaining,
				Currency:  fundingErr.Currency,
				Message:   "goal funding required before marking done",
				ErrorCode: "goal_funding_required",
			})
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to mark goal done", err)
		return
	}
	httputil.Success(w, map[string]interface{}{
		"goal":         goal,
		"progress":     goal.Progress(),
		"is_completed": goal.IsCompleted(),
	})
}
