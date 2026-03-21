package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// FinancialDNAHandler handles financial DNA and behavioral analytics endpoints
type FinancialDNAHandler struct {
dnaService *service.FinancialDNAService
}

// NewFinancialDNAHandler creates a new handler
func NewFinancialDNAHandler(dnaService *service.FinancialDNAService) *FinancialDNAHandler {
return &FinancialDNAHandler{dnaService: dnaService}
}

// GetDNA returns the user's financial DNA profile
// @Summary Get Financial DNA
// @Description Get the user's financial personality profile
// @Tags Financial DNA
// @Accept json
// @Produce json
// @Success 200 {object} model.FinancialDNA
// @Failure 401 {object} httputil.ErrorResponse
// @Failure 500 {object} httputil.ErrorResponse
// @Router /api/v1/dna [get]
func (h *FinancialDNAHandler) GetDNA(w http.ResponseWriter, r *http.Request) {
ctx := r.Context()
userID, ok := middleware.GetUserIDFromContext(ctx)
if !ok {
httputil.UnauthorizedWithContext(ctx, w, "Unauthorized")
return
}

dna, err := h.dnaService.GetDNA(ctx, userID)
if err != nil {
httputil.InternalServerErrorWithContext(ctx, w, "Failed to get financial DNA", err)
return
}

httputil.JSON(w, http.StatusOK, dna)
}

// RefreshDNA recalculates the user's financial DNA
// @Summary Refresh Financial DNA
// @Description Force recalculation of financial personality profile
// @Tags Financial DNA
// @Accept json
// @Produce json
// @Success 200 {object} model.FinancialDNA
// @Failure 401 {object} httputil.ErrorResponse
// @Failure 500 {object} httputil.ErrorResponse
// @Router /api/v1/dna/refresh [post]
func (h *FinancialDNAHandler) RefreshDNA(w http.ResponseWriter, r *http.Request) {
ctx := r.Context()
userID, ok := middleware.GetUserIDFromContext(ctx)
if !ok {
httputil.UnauthorizedWithContext(ctx, w, "Unauthorized")
return
}

dna, err := h.dnaService.CalculateDNA(ctx, userID)
if err != nil {
httputil.InternalServerErrorWithContext(ctx, w, "Failed to refresh financial DNA", err)
return
}

httputil.JSON(w, http.StatusOK, dna)
}

// GetInsights returns behavioral insights for the user
// @Summary Get Behavioral Insights
// @Description Get behavioral patterns and recommendations
// @Tags Financial DNA
// @Accept json
// @Produce json
// @Param limit query int false "Max number of insights" default(20)
// @Success 200 {object} InsightsResponse
// @Failure 401 {object} httputil.ErrorResponse
// @Failure 500 {object} httputil.ErrorResponse
// @Router /api/v1/dna/insights [get]
func (h *FinancialDNAHandler) GetInsights(w http.ResponseWriter, r *http.Request) {
ctx := r.Context()
userID, ok := middleware.GetUserIDFromContext(ctx)
if !ok {
httputil.UnauthorizedWithContext(ctx, w, "Unauthorized")
return
}

limit := 20
if l := r.URL.Query().Get("limit"); l != "" {
if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
limit = parsed
}
}

insights, err := h.dnaService.GetInsights(ctx, userID, limit)
if err != nil {
httputil.InternalServerErrorWithContext(ctx, w, "Failed to get insights", err)
return
}

unreadCount, _ := h.dnaService.GetUnreadInsightCount(ctx, userID)

httputil.JSON(w, http.StatusOK, InsightsResponse{
Insights:    insights,
UnreadCount: unreadCount,
})
}

// InsightsResponse is the response for GetInsights
type InsightsResponse struct {
Insights    []model.BehavioralInsight `json:"insights"`
UnreadCount int           `json:"unread_count"`
}

// MarkInsightRead marks an insight as read
// @Summary Mark Insight Read
// @Description Mark a behavioral insight as read
// @Tags Financial DNA
// @Accept json
// @Produce json
// @Param id path string true "Insight ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} httputil.ErrorResponse
// @Failure 401 {object} httputil.ErrorResponse
// @Failure 500 {object} httputil.ErrorResponse
// @Router /api/v1/dna/insights/{id}/read [post]
func (h *FinancialDNAHandler) MarkInsightRead(w http.ResponseWriter, r *http.Request) {
ctx := r.Context()
userID, ok := middleware.GetUserIDFromContext(ctx)
if !ok {
httputil.UnauthorizedWithContext(ctx, w, "Unauthorized")
return
}

// Parse insight ID from URL
var req struct {
InsightID string `json:"insight_id"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
httputil.BadRequestWithContext(ctx, w, "Invalid request body")
return
}

insightID, err := uuid.Parse(req.InsightID)
if err != nil {
httputil.BadRequestWithContext(ctx, w, "Invalid insight ID")
return
}

if err := h.dnaService.MarkInsightRead(ctx, userID, insightID); err != nil {
httputil.InternalServerErrorWithContext(ctx, w, "Failed to mark insight as read", err)
return
}

httputil.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GenerateInsights triggers insight generation
// @Summary Generate Insights
// @Description Analyze recent activity and create new insights
// @Tags Financial DNA
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string
// @Failure 401 {object} httputil.ErrorResponse
// @Failure 500 {object} httputil.ErrorResponse
// @Router /api/v1/dna/insights/generate [post]
func (h *FinancialDNAHandler) GenerateInsights(w http.ResponseWriter, r *http.Request) {
ctx := r.Context()
userID, ok := middleware.GetUserIDFromContext(ctx)
if !ok {
httputil.UnauthorizedWithContext(ctx, w, "Unauthorized")
return
}

if err := h.dnaService.GenerateInsights(ctx, userID); err != nil {
httputil.InternalServerErrorWithContext(ctx, w, "Failed to generate insights", err)
return
}

httputil.JSON(w, http.StatusOK, map[string]string{"status": "ok", "message": "Insights generated"})
}

// GetQuizQuestions returns the DNA assessment quiz questions
// @Summary Get Quiz Questions
// @Description Get the financial DNA assessment quiz questions
// @Tags Financial DNA
// @Accept json
// @Produce json
// @Success 200 {array} model.DNAQuizQuestion
// @Router /api/v1/dna/quiz [get]
func (h *FinancialDNAHandler) GetQuizQuestions(w http.ResponseWriter, r *http.Request) {
questions := []map[string]interface{}{
{
"id":       "q1_saving_priority",
"text":     "When you receive extra income, what's your first instinct?",
"category": "spending",
"dimension": "spending_temperament",
"options": []string{
"Save all of it",
"Save most, treat myself a little",
"Split 50/50 between saving and spending",
"Spend most, save a little",
"Treat myself - I deserve it",
},
},
{
"id":       "q2_purchase_style",
"text":     "How do you typically approach a major purchase?",
"category": "planning",
"dimension": "impulse_control",
"options": []string{
"Research extensively, wait for sales",
"Do some research, decide within a week",
"Trust my gut, buy if it feels right",
"Act quickly when I see something I want",
"Buy immediately - life is short",
},
},
{
"id":       "q3_financial_worry",
"text":     "How often do you worry about money?",
"category": "stress",
"dimension": "financial_stress",
"options": []string{
"Rarely - I feel financially secure",
"Occasionally, but I manage it well",
"Sometimes - it depends on the month",
"Often - it's frequently on my mind",
"Constantly - it's a major source of stress",
},
},
{
"id":       "q4_investment_comfort",
"text":     "How do you feel about investing in stocks or crypto?",
"category": "risk",
"dimension": "risk_tolerance",
"options": []string{
"Too risky - I prefer guaranteed returns",
"Open to low-risk investments only",
"Comfortable with a balanced portfolio",
"Excited about growth opportunities",
"Love the thrill - high risk, high reward",
},
},
{
"id":       "q5_budget_approach",
"text":     "How do you handle budgeting?",
"category": "planning",
"dimension": "planning_horizon",
"options": []string{
"Detailed monthly budget I track closely",
"General budget with some flexibility",
"Mental budget - rough idea of limits",
"Spend freely, check balance occasionally",
"Don't budget - figure it out as I go",
},
},
}

httputil.JSON(w, http.StatusOK, questions)
}
