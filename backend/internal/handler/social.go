package handler

import (
"encoding/json"
"net/http"
"strconv"
"time"

"github.com/go-chi/chi/v5"
"github.com/google/uuid"
"github.com/rezacr588/currency-converter/internal/middleware"
"github.com/rezacr588/currency-converter/internal/model"
"github.com/rezacr588/currency-converter/internal/service"
"github.com/rezacr588/currency-converter/pkg/httputil"
)

// SocialHandler handles shared spaces and collaborative finance endpoints
type SocialHandler struct {
socialService *service.SocialService
}

// NewSocialHandler creates a new social handler
func NewSocialHandler(socialService *service.SocialService) *SocialHandler {
return &SocialHandler{socialService: socialService}
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

if err := h.socialService.DeleteSpace(ctx, userID, spaceID); err != nil {
httputil.BadRequestWithContext(ctx, w, err.Error())
return
}

httputil.JSON(w, http.StatusOK, map[string]string{"message": "space deleted"})
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

invite, err := h.socialService.InviteMember(ctx, userID, spaceID, req.Email, req.Role)
if err != nil {
httputil.BadRequestWithContext(ctx, w, err.Error())
return
}

httputil.JSON(w, http.StatusCreated, invite)
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

if err := h.socialService.DeleteExpense(ctx, userID, expenseID); err != nil {
httputil.BadRequestWithContext(ctx, w, err.Error())
return
}

httputil.JSON(w, http.StatusOK, map[string]string{"message": "expense deleted"})
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

if err := h.socialService.ConfirmSettlement(ctx, userID, settlementID); err != nil {
httputil.BadRequestWithContext(ctx, w, err.Error())
return
}

httputil.JSON(w, http.StatusOK, map[string]string{"message": "settlement confirmed"})
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
