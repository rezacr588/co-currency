package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	ws "github.com/rezacr588/currency-converter/internal/websocket"
	"github.com/rezacr588/currency-converter/pkg/httputil"
	"github.com/rs/zerolog/log"
)

// SocialHandler handles shared spaces and collaborative finance endpoints
type SocialHandler struct {
	socialService *service.SocialService
	wsPublisher   *ws.Publisher
}

// NewSocialHandler creates a new social handler
func NewSocialHandler(socialService *service.SocialService, wsPublisher *ws.Publisher) *SocialHandler {
	return &SocialHandler{
		socialService: socialService,
		wsPublisher:   wsPublisher,
	}
}

func (h *SocialHandler) publishSocialToUsers(ctx context.Context, userIDs []uuid.UUID, action string, details map[string]interface{}) {
	if h.wsPublisher == nil || len(userIDs) == 0 {
		return
	}
	payload := map[string]interface{}{
		"action":  action,
		"details": details,
	}
	if err := h.wsPublisher.PublishToUsers(ctx, userIDs, ws.MessageTypeSocialUpdate, payload); err != nil {
		log.Warn().Err(err).Str("action", action).Msg("Failed to publish social websocket update")
	}
}

func (h *SocialHandler) publishSpaceUpdate(ctx context.Context, spaceID uuid.UUID, action string, details map[string]interface{}) {
	if h.wsPublisher == nil || spaceID == uuid.Nil {
		return
	}
	members, err := h.socialService.GetSpaceMembers(ctx, spaceID)
	if err != nil {
		log.Warn().Err(err).Str("space_id", spaceID.String()).Msg("Failed to load space members for websocket publish")
		return
	}
	userIDs := make([]uuid.UUID, 0, len(members))
	for _, m := range members {
		userIDs = append(userIDs, m.UserID)
	}
	if len(userIDs) == 0 {
		return
	}
	payload := map[string]interface{}{
		"action":   action,
		"space_id": spaceID.String(),
		"details":  details,
	}
	if err := h.wsPublisher.PublishToUsers(ctx, userIDs, ws.MessageTypeSpaceUpdate, payload); err != nil {
		log.Warn().Err(err).Str("space_id", spaceID.String()).Str("action", action).Msg("Failed to publish space websocket update")
	}
}

// CreateSpace creates a new shared space
func (h *SocialHandler) CreateSpace(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	var req model.CreateSpaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body", err)
		return
	}

	space, err := h.socialService.CreateSpace(ctx, userID, &req)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to create space", err)
		return
	}

	httputil.JSON(w, http.StatusCreated, space)
	h.publishSocialToUsers(ctx, []uuid.UUID{userID}, "space_created", map[string]interface{}{
		"space_id": space.ID.String(),
		"name":     space.Name,
	})
}

// GetSpace retrieves a space
func (h *SocialHandler) GetSpace(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	space, err := h.socialService.GetSpace(ctx, userID, spaceID)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusOK, space)
}

// ListSpaces lists all spaces for the user
func (h *SocialHandler) ListSpaces(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaces, err := h.socialService.GetUserSpaces(ctx, userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to list spaces", err)
		return
	}

	if spaces == nil {
		spaces = []model.SharedSpace{}
	}
	httputil.JSON(w, http.StatusOK, map[string]interface{}{"spaces": spaces})
}

// UpdateSpace updates a space
func (h *SocialHandler) UpdateSpace(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	var req struct {
		Name        string              `json:"name"`
		Description string              `json:"description"`
		IconEmoji   string              `json:"icon_emoji"`
		Settings    model.SpaceSettings `json:"settings"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body", err)
		return
	}

	if err := h.socialService.UpdateSpace(ctx, userID, spaceID, req.Name, req.Description, req.IconEmoji, req.Settings); err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"message": "space updated"})
	h.publishSpaceUpdate(ctx, spaceID, "space_updated", map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"icon_emoji":  req.IconEmoji,
	})
}

// DeleteSpace deletes a space
func (h *SocialHandler) DeleteSpace(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	members, _ := h.socialService.GetSpaceMembers(ctx, spaceID)
	if err := h.socialService.DeleteSpace(ctx, userID, spaceID); err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"message": "space deleted"})
	userIDs := make([]uuid.UUID, 0, len(members))
	for _, m := range members {
		userIDs = append(userIDs, m.UserID)
	}
	h.publishSocialToUsers(ctx, userIDs, "space_deleted", map[string]interface{}{
		"space_id": spaceID.String(),
	})
}

// InviteMember invites someone to a space
func (h *SocialHandler) InviteMember(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	var req model.InviteMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body", err)
		return
	}
	if req.Role == "" {
		req.Role = model.SpaceRoleMember
	}

	invite, err := h.socialService.InviteMember(ctx, userID, spaceID, req.Email, req.Role)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusCreated, invite)
	h.publishSpaceUpdate(ctx, spaceID, "member_invited", map[string]interface{}{
		"invite_id": invite.ID.String(),
		"email":     invite.InviteeEmail,
		"role":      invite.Role,
	})
}

// AcceptInvite accepts a space invitation
func (h *SocialHandler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	code := chi.URLParam(r, "code")
	if code == "" {
		httputil.BadRequestWithContext(ctx, w, "invite code required")
		return
	}

	space, err := h.socialService.AcceptInvite(ctx, userID, code)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusOK, space)
	h.publishSpaceUpdate(ctx, space.ID, "member_joined", map[string]interface{}{
		"user_id": userID.String(),
	})
}

// RespondInvite accepts or rejects a space invitation by code.
func (h *SocialHandler) RespondInvite(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	code := chi.URLParam(r, "code")
	if code == "" {
		httputil.BadRequestWithContext(ctx, w, "invite code required")
		return
	}

	var req struct {
		Accept bool `json:"accept"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body", err)
		return
	}

	space, err := h.socialService.RespondInvite(ctx, userID, code, req.Accept)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	if req.Accept {
		httputil.JSON(w, http.StatusOK, map[string]interface{}{
			"message": "invite accepted",
			"space":   space,
		})
		if space != nil {
			h.publishSpaceUpdate(ctx, space.ID, "member_joined", map[string]interface{}{
				"user_id": userID.String(),
			})
		}
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"message": "invite declined"})
}

// GetPendingInvites gets pending invites for the user
func (h *SocialHandler) GetPendingInvites(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	email, ok := middleware.GetUserEmailFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	invites, err := h.socialService.GetPendingInvites(ctx, email)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to get invites", err)
		return
	}

	if invites == nil {
		invites = []model.SpaceInvite{}
	}
	httputil.JSON(w, http.StatusOK, map[string]interface{}{"invites": invites})
}

// LeaveSpace removes user from a space
func (h *SocialHandler) LeaveSpace(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	if err := h.socialService.LeaveSpace(ctx, userID, spaceID); err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"message": "left space"})
	h.publishSpaceUpdate(ctx, spaceID, "member_left", map[string]interface{}{
		"user_id": userID.String(),
	})
}

// RemoveMember removes a member from a space
func (h *SocialHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	memberID, err := uuid.Parse(chi.URLParam(r, "memberId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid member ID")
		return
	}

	if err := h.socialService.RemoveMember(ctx, userID, spaceID, memberID); err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"message": "member removed"})
	h.publishSpaceUpdate(ctx, spaceID, "member_removed", map[string]interface{}{
		"member_id": memberID.String(),
	})
}

// AddExpense adds an expense to a space
func (h *SocialHandler) AddExpense(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	var req model.CreateExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body", err)
		return
	}

	expense, err := h.socialService.AddExpense(ctx, userID, spaceID, &req)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusCreated, expense)
	h.publishSpaceUpdate(ctx, spaceID, "expense_added", map[string]interface{}{
		"expense_id":   expense.ID.String(),
		"amount":       expense.Amount,
		"currency":     expense.Currency,
		"description":  expense.Description,
		"paid_by_user": expense.PaidByUserID.String(),
	})
}

// GetExpense retrieves an expense
func (h *SocialHandler) GetExpense(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	expenseID, err := uuid.Parse(chi.URLParam(r, "expenseId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid expense ID")
		return
	}

	expense, err := h.socialService.GetExpense(ctx, userID, expenseID)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusOK, expense)
}

// ListExpenses lists expenses in a space
func (h *SocialHandler) ListExpenses(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	expenses, total, err := h.socialService.ListExpenses(ctx, userID, spaceID, limit, offset)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	if expenses == nil {
		expenses = []model.SharedExpense{}
	}
	httputil.JSON(w, http.StatusOK, map[string]interface{}{
		"expenses": expenses,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

// DeleteExpense deletes an expense
func (h *SocialHandler) DeleteExpense(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	expenseID, err := uuid.Parse(chi.URLParam(r, "expenseId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid expense ID")
		return
	}

	expense, _ := h.socialService.GetExpense(ctx, userID, expenseID)
	if err := h.socialService.DeleteExpense(ctx, userID, expenseID); err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"message": "expense deleted"})
	if expense != nil {
		h.publishSpaceUpdate(ctx, expense.SpaceID, "expense_deleted", map[string]interface{}{
			"expense_id": expenseID.String(),
		})
	}
}

// RecordSettlement records a settlement
func (h *SocialHandler) RecordSettlement(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	var req model.CreateSettlementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body", err)
		return
	}

	settlement, err := h.socialService.RecordSettlement(ctx, userID, spaceID, &req)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusCreated, settlement)
	h.publishSpaceUpdate(ctx, spaceID, "settlement_recorded", map[string]interface{}{
		"settlement_id": settlement.ID.String(),
		"from_user_id":  settlement.FromUserID.String(),
		"to_user_id":    settlement.ToUserID.String(),
		"amount":        settlement.Amount,
		"currency":      settlement.Currency,
	})
}

// ConfirmSettlement confirms a settlement
func (h *SocialHandler) ConfirmSettlement(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	settlementID, err := uuid.Parse(chi.URLParam(r, "settlementId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid settlement ID")
		return
	}

	spaceID, err := h.socialService.GetSettlementSpaceID(ctx, settlementID)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	if err := h.socialService.ConfirmSettlement(ctx, userID, settlementID); err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"message": "settlement confirmed"})
	h.publishSpaceUpdate(ctx, spaceID, "settlement_confirmed", map[string]interface{}{
		"settlement_id": settlementID.String(),
		"confirmed_by":  userID.String(),
	})
}

// ListSettlements lists settlements in a space
func (h *SocialHandler) ListSettlements(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	settlements, err := h.socialService.ListSettlements(ctx, userID, spaceID, limit, offset)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	if settlements == nil {
		settlements = []model.Settlement{}
	}
	httputil.JSON(w, http.StatusOK, map[string]interface{}{"settlements": settlements})
}

// GetBalances gets balance summary for a space
func (h *SocialHandler) GetBalances(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	summary, err := h.socialService.GetBalances(ctx, userID, spaceID)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusOK, summary)
}

// CreateBudget creates a shared budget
func (h *SocialHandler) CreateBudget(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	var req struct {
		Name      string  `json:"name"`
		Category  string  `json:"category"`
		Amount    float64 `json:"amount"`
		Currency  string  `json:"currency"`
		Period    string  `json:"period"`
		StartDate string  `json:"start_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body", err)
		return
	}

	startDate, err := parseDate(req.StartDate)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid start date")
		return
	}

	budget, err := h.socialService.CreateBudget(ctx, userID, spaceID, req.Name, req.Category, req.Currency, req.Amount, req.Period, startDate)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.JSON(w, http.StatusCreated, budget)
	h.publishSpaceUpdate(ctx, spaceID, "budget_created", map[string]interface{}{
		"budget_id": budget.ID.String(),
		"name":      budget.Name,
		"amount":    budget.Amount,
		"currency":  budget.Currency,
	})
}

// ListBudgets lists budgets in a space
func (h *SocialHandler) ListBudgets(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	budgets, err := h.socialService.ListBudgets(ctx, userID, spaceID)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	if budgets == nil {
		budgets = []model.SharedBudget{}
	}
	httputil.JSON(w, http.StatusOK, map[string]interface{}{"budgets": budgets})
}

// GetActivities gets recent activities in a space
func (h *SocialHandler) GetActivities(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "unauthorized")
		return
	}

	spaceID, err := uuid.Parse(chi.URLParam(r, "spaceId"))
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid space ID")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	activities, err := h.socialService.GetActivities(ctx, userID, spaceID, limit)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	if activities == nil {
		activities = []model.SpaceActivity{}
	}
	httputil.JSON(w, http.StatusOK, map[string]interface{}{"activities": activities})
}

func parseDate(s string) (time.Time, error) {
	if s == "" {
		return time.Now(), nil
	}
	return time.Parse("2006-01-02", s)
}
