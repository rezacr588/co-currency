package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// Common errors for planning engine
var (
	ErrPlanNotFound         = errors.New("plan not found")
	ErrStepNotFound         = errors.New("step not found")
	ErrApprovalNotFound     = errors.New("approval not found")
	ErrInvalidPlanStatus    = errors.New("invalid plan status transition")
	ErrPlanNotActive        = errors.New("plan is not active")
	ErrStepNotPending       = errors.New("step is not pending approval")
	ErrMaxActivePlans       = errors.New("maximum active plans limit reached")
	ErrInvalidTimezone      = errors.New("invalid IANA timezone (e.g. 'America/New_York', 'Asia/Tehran')")
	ErrInvalidAutopilotTime = errors.New("invalid autopilot time (expected HH:MM or HH:MM:SS, 24-hour)")
)

const (
	// MaxActivePlans is the maximum number of active plans per user
	MaxActivePlans = 10
)

// PlanningEngineService handles plan creation, management, and AI-driven planning
type PlanningEngineService struct {
	agentRepo *repository.AgentPlanRepository
	aiService *AIChatService // For AI-driven plan generation
}

// NewPlanningEngineService creates a new planning engine service
func NewPlanningEngineService(agentRepo *repository.AgentPlanRepository, aiService *AIChatService) *PlanningEngineService {
	return &PlanningEngineService{
		agentRepo: agentRepo,
		aiService: aiService,
	}
}

// CreatePlan creates a new agent plan
func (s *PlanningEngineService) CreatePlan(ctx context.Context, userID uuid.UUID, req *model.CreatePlanRequest) (*model.AgentPlan, error) {
	// Check active plans limit
	activeCount, err := s.agentRepo.GetActivePlansCount(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check active plans: %w", err)
	}
	if activeCount >= MaxActivePlans {
		return nil, ErrMaxActivePlans
	}

	// Set defaults
	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}

	plan := &model.AgentPlan{
		ID:             uuid.New(),
		UserID:         userID,
		Title:          req.Title,
		Description:    req.Description,
		GoalType:       req.GoalType,
		Status:         "draft",
		Priority:       priority,
		TargetAmount:   req.TargetAmount,
		TargetCurrency: req.TargetCurrency,
		TargetDate:     req.TargetDate,
		Metadata:       req.Metadata,
	}

	if err := s.agentRepo.CreatePlan(ctx, plan); err != nil {
		return nil, fmt.Errorf("failed to create plan: %w", err)
	}

	return plan, nil
}

// GetPlan retrieves a plan by ID with steps
func (s *PlanningEngineService) GetPlan(ctx context.Context, userID, planID uuid.UUID) (*model.AgentPlan, error) {
	plan, err := s.agentRepo.GetPlanByID(ctx, planID)
	if err != nil {
		if errors.Is(err, repository.ErrPlanNotFound) {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}

	// Verify ownership
	if plan.UserID != userID {
		return nil, ErrPlanNotFound
	}

	// Get steps
	steps, err := s.agentRepo.GetStepsByPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("failed to get plan steps: %w", err)
	}
	plan.Steps = steps

	return plan, nil
}

// ListPlans retrieves all plans for a user
func (s *PlanningEngineService) ListPlans(ctx context.Context, userID uuid.UUID, status string, limit, offset int) ([]*model.AgentPlan, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	return s.agentRepo.GetPlansByUser(ctx, userID, status, limit, offset)
}

// ActivatePlan activates a draft plan
func (s *PlanningEngineService) ActivatePlan(ctx context.Context, userID, planID uuid.UUID) error {
	plan, err := s.GetPlan(ctx, userID, planID)
	if err != nil {
		return err
	}

	if plan.Status != "draft" {
		return ErrInvalidPlanStatus
	}

	return s.agentRepo.UpdatePlanStatus(ctx, userID, planID, "active")
}

// PausePlan pauses an active plan
func (s *PlanningEngineService) PausePlan(ctx context.Context, userID, planID uuid.UUID) error {
	plan, err := s.GetPlan(ctx, userID, planID)
	if err != nil {
		return err
	}

	if plan.Status != "active" {
		return ErrInvalidPlanStatus
	}

	return s.agentRepo.UpdatePlanStatus(ctx, userID, planID, "paused")
}

// ResumePlan resumes a paused plan
func (s *PlanningEngineService) ResumePlan(ctx context.Context, userID, planID uuid.UUID) error {
	plan, err := s.GetPlan(ctx, userID, planID)
	if err != nil {
		return err
	}

	if plan.Status != "paused" {
		return ErrInvalidPlanStatus
	}

	return s.agentRepo.UpdatePlanStatus(ctx, userID, planID, "active")
}

// CancelPlan cancels a plan
func (s *PlanningEngineService) CancelPlan(ctx context.Context, userID, planID uuid.UUID) error {
	plan, err := s.GetPlan(ctx, userID, planID)
	if err != nil {
		return err
	}

	if plan.Status == "completed" || plan.Status == "cancelled" {
		return ErrInvalidPlanStatus
	}

	return s.agentRepo.UpdatePlanStatus(ctx, userID, planID, "cancelled")
}

// AddStep adds a step to a plan
func (s *PlanningEngineService) AddStep(ctx context.Context, userID, planID uuid.UUID, step *model.PlanStep) error {
	plan, err := s.GetPlan(ctx, userID, planID)
	if err != nil {
		return err
	}

	// Can only add steps to draft or active plans
	if plan.Status != "draft" && plan.Status != "active" {
		return ErrInvalidPlanStatus
	}

	// Determine step order
	step.StepOrder = len(plan.Steps) + 1
	step.PlanID = planID
	step.Status = "pending"

	return s.agentRepo.CreateStep(ctx, step)
}

// GetPendingApprovals retrieves all pending approvals for a user
func (s *PlanningEngineService) GetPendingApprovals(ctx context.Context, userID uuid.UUID) ([]*model.ActionApproval, error) {
	return s.agentRepo.GetPendingApprovals(ctx, userID)
}

// ApproveStep approves a pending step.
//
// Flow: verify plan ownership + step state via the in-memory plan snapshot,
// then resolve the pending approval directly by step_id (user-scoped), then
// flip the approval + step atomically via ApproveAction. The in-memory
// `status != "pending"` check is just for clearer error messaging — the real
// race guard is the `approval_status = 'pending'` WHERE clause inside
// ApproveAction's transaction, which cannot be bypassed.
func (s *PlanningEngineService) ApproveStep(ctx context.Context, userID, planID, stepID uuid.UUID, method string, deviceInfo map[string]interface{}) error {
	plan, err := s.GetPlan(ctx, userID, planID)
	if err != nil {
		return err
	}

	var targetStep *model.PlanStep
	for _, step := range plan.Steps {
		if step.ID == stepID {
			targetStep = step
			break
		}
	}
	if targetStep == nil {
		return ErrStepNotFound
	}
	if targetStep.Status != "pending" {
		return ErrStepNotPending
	}

	approvalID, err := s.agentRepo.GetPendingApprovalByStepID(ctx, userID, stepID)
	if err != nil {
		if errors.Is(err, repository.ErrApprovalNotFound) {
			return ErrApprovalNotFound
		}
		return err
	}

	return s.agentRepo.ApproveAction(ctx, approvalID, method, deviceInfo)
}

// RejectStep rejects a pending step. See ApproveStep for the flow notes.
func (s *PlanningEngineService) RejectStep(ctx context.Context, userID, planID, stepID uuid.UUID, reason string) error {
	plan, err := s.GetPlan(ctx, userID, planID)
	if err != nil {
		return err
	}

	var targetStep *model.PlanStep
	for _, step := range plan.Steps {
		if step.ID == stepID {
			targetStep = step
			break
		}
	}
	if targetStep == nil {
		return ErrStepNotFound
	}
	if targetStep.Status != "pending" {
		return ErrStepNotPending
	}

	approvalID, err := s.agentRepo.GetPendingApprovalByStepID(ctx, userID, stepID)
	if err != nil {
		if errors.Is(err, repository.ErrApprovalNotFound) {
			return ErrApprovalNotFound
		}
		return err
	}

	return s.agentRepo.RejectAction(ctx, approvalID, reason)
}

// GetConfig retrieves user's agent configuration
func (s *PlanningEngineService) GetConfig(ctx context.Context, userID uuid.UUID) (*model.AgentConfig, error) {
	config, err := s.agentRepo.GetConfig(ctx, userID)
	if errors.Is(err, repository.ErrConfigNotFound) {
		// Return default config
		return &model.AgentConfig{
			UserID:                  userID,
			Enabled:                 true,
			AutoApproveThreshold:    10.00,
			AutoApproveCurrency:     "USD",
			RequireBiometricAbove:   100.00,
			DailyAutopilotEnabled:   true,
			AutopilotTime:           "08:00:00",
			AutopilotTimezone:       "UTC",
			AllowedActionTypes:      []string{"alert", "recommendation"},
			NotificationPreferences: map[string]interface{}{"push": true, "email": false},
		}, nil
	}
	return config, err
}

// UpdateConfig updates user's agent configuration. Validates the timezone
// and autopilot_time fields because both participate in a per-row SQL query
// (GetUsersDueForAutopilot) — a bad value would skip only the invalid user
// (not the whole batch, thanks to the pg_timezone_names guard) but surfacing
// the error early gives the user a clear fix instead of silently never being
// scanned.
func (s *PlanningEngineService) UpdateConfig(ctx context.Context, userID uuid.UUID, req *model.UpdateConfigRequest) (*model.AgentConfig, error) {
	if req.AutopilotTimezone != nil && *req.AutopilotTimezone != "" {
		if _, err := time.LoadLocation(*req.AutopilotTimezone); err != nil {
			return nil, ErrInvalidTimezone
		}
	}
	if req.AutopilotTime != nil && *req.AutopilotTime != "" {
		if !isValidAutopilotTime(*req.AutopilotTime) {
			return nil, ErrInvalidAutopilotTime
		}
	}

	config, err := s.GetConfig(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Apply updates
	if req.Enabled != nil {
		config.Enabled = *req.Enabled
	}
	if req.AutoApproveThreshold != nil {
		config.AutoApproveThreshold = *req.AutoApproveThreshold
	}
	if req.AutoApproveCurrency != nil {
		config.AutoApproveCurrency = *req.AutoApproveCurrency
	}
	if req.RequireBiometricAbove != nil {
		config.RequireBiometricAbove = *req.RequireBiometricAbove
	}
	if req.DailyAutopilotEnabled != nil {
		config.DailyAutopilotEnabled = *req.DailyAutopilotEnabled
	}
	if req.AutopilotTime != nil {
		config.AutopilotTime = *req.AutopilotTime
	}
	if req.AutopilotTimezone != nil {
		config.AutopilotTimezone = *req.AutopilotTimezone
	}
	if req.AllowedActionTypes != nil {
		config.AllowedActionTypes = req.AllowedActionTypes
	}
	if req.NotificationPreferences != nil {
		config.NotificationPreferences = req.NotificationPreferences
	}

	config.UserID = userID
	if err := s.agentRepo.UpsertConfig(ctx, config); err != nil {
		return nil, fmt.Errorf("failed to update config: %w", err)
	}

	return config, nil
}

// GetActionLogs retrieves action logs for a user
func (s *PlanningEngineService) GetActionLogs(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*model.ActionLog, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	return s.agentRepo.GetLogsByUser(ctx, userID, limit, offset)
}

// LogAction creates an action log entry
func (s *PlanningEngineService) LogAction(ctx context.Context, log *model.ActionLog) error {
	return s.agentRepo.CreateLog(ctx, log)
}

// GeneratePlanWithAI uses AI to generate a plan based on user's financial context
func (s *PlanningEngineService) GeneratePlanWithAI(ctx context.Context, userID uuid.UUID, goalType string, targetAmount float64, currency string) (*model.AgentPlan, error) {
	if s.aiService == nil {
		return nil, errors.New("AI service not available")
	}

	// Build prompt for AI (kept for future AI integration)
	_ = fmt.Sprintf(`Generate a financial plan with the following goal:
- Goal Type: %s
- Target Amount: %.2f %s

Respond with a JSON object containing:
{
  "title": "Brief plan title",
  "description": "Detailed description of the plan",
  "reasoning": "Why this plan will help achieve the goal",
  "steps": [
    {
      "title": "Step title",
      "description": "Step description",
      "action_type": "one of: transfer, goal_contribution, budget_adjustment, recurring_update, subscription_cancel, debt_payment, alert, recommendation",
      "action_params": {"key": "value"},
      "estimated_impact": 0.00
    }
  ]
}

Important:
- Steps should be actionable and specific
- Each step should have a clear estimated financial impact
- Order steps from highest impact to lowest
- Include 3-7 steps total
- Focus on practical actions the user can take`, goalType, targetAmount, currency)

	// TODO: Call AI service with prompt to generate personalized plan
	// For now, return a template plan
	plan := &model.AgentPlan{
		ID:             uuid.New(),
		UserID:         userID,
		Title:          fmt.Sprintf("%s Plan", goalType),
		GoalType:       goalType,
		Status:         "draft",
		Priority:       "medium",
		TargetAmount:   &targetAmount,
		TargetCurrency: &currency,
		AIReasoning:    stringPtr("AI-generated plan based on your financial profile and goals."),
	}

	// Generate sample steps based on goal type
	steps := s.generateDefaultSteps(goalType, targetAmount, currency)
	plan.Steps = steps

	// Save plan
	if err := s.agentRepo.CreatePlan(ctx, plan); err != nil {
		return nil, fmt.Errorf("failed to save AI-generated plan: %w", err)
	}

	// Save steps
	for _, step := range steps {
		step.PlanID = plan.ID
		if err := s.agentRepo.CreateStep(ctx, step); err != nil {
			return nil, fmt.Errorf("failed to save plan step: %w", err)
		}
	}

	return plan, nil
}

// generateDefaultSteps generates default steps based on goal type
func (s *PlanningEngineService) generateDefaultSteps(goalType string, targetAmount float64, currency string) []*model.PlanStep {
	var steps []*model.PlanStep

	switch goalType {
	case "savings":
		steps = []*model.PlanStep{
			{
				ID:               uuid.New(),
				StepOrder:        1,
				Title:            "Review current expenses",
				Description:      stringPtr("Analyze spending patterns to identify savings opportunities"),
				ActionType:       "recommendation",
				ActionParams:     map[string]interface{}{"action": "expense_review"},
				RequiresApproval: false,
			},
			{
				ID:               uuid.New(),
				StepOrder:        2,
				Title:            "Set up automatic transfer",
				Description:      stringPtr(fmt.Sprintf("Configure weekly transfer to savings goal")),
				ActionType:       "goal_contribution",
				ActionParams:     map[string]interface{}{"frequency": "weekly", "amount": targetAmount / 12},
				EstimatedImpact:  floatPtr(targetAmount / 12),
				RequiresApproval: true,
			},
			{
				ID:               uuid.New(),
				StepOrder:        3,
				Title:            "Reduce discretionary spending",
				Description:      stringPtr("Identify and reduce non-essential expenses by 10%"),
				ActionType:       "budget_adjustment",
				ActionParams:     map[string]interface{}{"category": "discretionary", "reduction_pct": 10},
				EstimatedImpact:  floatPtr(targetAmount * 0.1),
				RequiresApproval: true,
			},
		}

	case "debt_payoff":
		steps = []*model.PlanStep{
			{
				ID:               uuid.New(),
				StepOrder:        1,
				Title:            "List all debts",
				Description:      stringPtr("Review and prioritize debts by interest rate"),
				ActionType:       "recommendation",
				ActionParams:     map[string]interface{}{"action": "debt_inventory"},
				RequiresApproval: false,
			},
			{
				ID:               uuid.New(),
				StepOrder:        2,
				Title:            "Extra payment to highest interest debt",
				Description:      stringPtr("Make additional payment to the debt with highest interest rate"),
				ActionType:       "debt_payment",
				ActionParams:     map[string]interface{}{"strategy": "avalanche"},
				EstimatedImpact:  floatPtr(targetAmount * 0.15),
				RequiresApproval: true,
			},
			{
				ID:               uuid.New(),
				StepOrder:        3,
				Title:            "Set up bi-weekly payments",
				Description:      stringPtr("Switch from monthly to bi-weekly payments for faster payoff"),
				ActionType:       "recurring_update",
				ActionParams:     map[string]interface{}{"frequency": "biweekly"},
				RequiresApproval: true,
			},
		}

	case "budget_optimization":
		steps = []*model.PlanStep{
			{
				ID:               uuid.New(),
				StepOrder:        1,
				Title:            "Analyze spending patterns",
				Description:      stringPtr("Review the last 3 months of transactions"),
				ActionType:       "recommendation",
				ActionParams:     map[string]interface{}{"action": "spending_analysis"},
				RequiresApproval: false,
			},
			{
				ID:               uuid.New(),
				StepOrder:        2,
				Title:            "Review subscriptions",
				Description:      stringPtr("Identify unused or underutilized subscriptions"),
				ActionType:       "subscription_cancel",
				ActionParams:     map[string]interface{}{"threshold_days": 30},
				EstimatedImpact:  floatPtr(50.00),
				RequiresApproval: true,
			},
			{
				ID:               uuid.New(),
				StepOrder:        3,
				Title:            "Set category budgets",
				Description:      stringPtr("Create budgets for top spending categories"),
				ActionType:       "budget_adjustment",
				ActionParams:     map[string]interface{}{"categories": []string{"food", "entertainment", "shopping"}},
				RequiresApproval: true,
			},
		}

	default:
		// Generic steps
		steps = []*model.PlanStep{
			{
				ID:               uuid.New(),
				StepOrder:        1,
				Title:            "Review financial overview",
				Description:      stringPtr("Analyze current financial status"),
				ActionType:       "recommendation",
				ActionParams:     map[string]interface{}{"action": "overview"},
				RequiresApproval: false,
			},
			{
				ID:               uuid.New(),
				StepOrder:        2,
				Title:            "Create action plan",
				Description:      stringPtr("Define specific steps to achieve your goal"),
				ActionType:       "recommendation",
				ActionParams:     map[string]interface{}{"action": "planning"},
				RequiresApproval: false,
			},
		}
	}

	return steps
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func floatPtr(f float64) *float64 {
	return &f
}

// ExpireOldApprovals is called periodically to expire old approvals
func (s *PlanningEngineService) ExpireOldApprovals(ctx context.Context) (int, error) {
	return s.agentRepo.ExpireOldApprovals(ctx)
}

// GetDailyBriefing generates or retrieves the daily briefing for a user
func (s *PlanningEngineService) GetDailyBriefing(ctx context.Context, userID uuid.UUID) (*model.DailyBriefing, error) {
	today := time.Now().UTC().Truncate(24 * time.Hour)

	result, err := s.agentRepo.GetOrCreateAutopilotResult(ctx, userID, today)
	if err != nil {
		return nil, fmt.Errorf("failed to get autopilot result: %w", err)
	}

	// If already completed today, return cached result
	if result.Status == "completed" {
		return s.convertAutopilotResultToBriefing(result)
	}

	// Generate new briefing (simplified - full implementation would analyze finances)
	briefing := &model.DailyBriefing{
		Date:              today,
		Status:            "generated",
		UpcomingBills:     []model.UpcomingBill{},
		BalanceHealth:     model.BalanceHealth{Status: "healthy", ProjectedBalance: 0, Currency: "USD"},
		GoalOpportunities: []model.GoalOpportunity{},
		PendingApprovals:  0,
		Insights:          []string{"Your finances look healthy today!"},
	}

	// Get pending approvals count
	approvals, err := s.agentRepo.GetPendingApprovals(ctx, userID)
	if err == nil {
		briefing.PendingApprovals = len(approvals)
	}

	return briefing, nil
}

func (s *PlanningEngineService) convertAutopilotResultToBriefing(result *model.DailyAutopilotResult) (*model.DailyBriefing, error) {
	briefing := &model.DailyBriefing{
		Date:             result.RunDate,
		Status:           result.Status,
		PendingApprovals: result.PendingApprovals,
		Insights:         []string{},
	}

	// Convert upcoming bills
	if result.UpcomingBills != nil {
		bills := make([]model.UpcomingBill, 0)
		data, _ := json.Marshal(result.UpcomingBills)
		json.Unmarshal(data, &bills)
		briefing.UpcomingBills = bills
	}

	// Convert balance predictions
	if result.BalancePredictions != nil {
		data, _ := json.Marshal(result.BalancePredictions)
		json.Unmarshal(data, &briefing.BalanceHealth)
	}

	// Convert goal opportunities
	if result.GoalOpportunities != nil {
		goals := make([]model.GoalOpportunity, 0)
		data, _ := json.Marshal(result.GoalOpportunities)
		json.Unmarshal(data, &goals)
		briefing.GoalOpportunities = goals
	}

	return briefing, nil
}

// isValidAutopilotTime accepts the 24-hour time-of-day strings that the
// `autopilot_time` column stores (Postgres `TIME` values). The frontend sends
// HH:MM:SS but older clients may send HH:MM; both parse cleanly.
func isValidAutopilotTime(s string) bool {
	if _, err := time.Parse("15:04", s); err == nil {
		return true
	}
	if _, err := time.Parse("15:04:05", s); err == nil {
		return true
	}
	return false
}

// GetAutopilotStatus returns the consolidated autopilot state for the UI.
// Missing config is treated as "disabled" rather than an error so the client
// can render an onboarding state without special-casing 404s.
func (s *PlanningEngineService) GetAutopilotStatus(ctx context.Context, userID uuid.UUID) (*model.AutopilotStatus, error) {
	status := &model.AutopilotStatus{}

	cfg, err := s.agentRepo.GetConfig(ctx, userID)
	if err != nil && !errors.Is(err, repository.ErrConfigNotFound) {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}
	if cfg != nil {
		status.Enabled = cfg.Enabled
		status.DailyAutopilotEnabled = cfg.DailyAutopilotEnabled
		status.AutopilotTime = cfg.AutopilotTime
		status.AutopilotTimezone = cfg.AutopilotTimezone
	}

	if last, err := s.agentRepo.GetLatestAutopilotResult(ctx, userID); err == nil {
		lastAt := last.CreatedAt
		status.LastRunAt = &lastAt
	}
	// Any other error (including "never ran") is non-fatal — render without a last-run timestamp.

	if cfg != nil && cfg.DailyAutopilotEnabled {
		if next := computeNextAutopilotRun(cfg, status.LastRunAt); !next.IsZero() {
			status.NextRunEstimate = &next
		}
	}

	// Count open plans (draft + active). Capped at MaxActivePlans in practice
	// so a full list scan is cheap; we don't need a dedicated COUNT query.
	if plans, _, err := s.agentRepo.GetPlansByUser(ctx, userID, "", 100, 0); err == nil {
		for _, p := range plans {
			if p.Status == "draft" || p.Status == "active" {
				status.PendingPlanCount++
			}
		}
	}

	if approvals, err := s.agentRepo.GetPendingApprovals(ctx, userID); err == nil {
		status.PendingApprovalCount = len(approvals)
	}

	return status, nil
}

// computeNextAutopilotRun estimates when the scheduler will next fire for the
// user, given their preferred time-of-day, timezone, and last-run timestamp.
// Returns zero-value time on unparseable timezone/time (UI hides the field).
//
// This mirrors — but does not enforce — the scheduler's dueGap window
// (20h). The scheduler is the source of truth; this is only a display hint.
func computeNextAutopilotRun(cfg *model.AgentConfig, lastRunAt *time.Time) time.Time {
	tz := cfg.AutopilotTimezone
	if tz == "" {
		tz = "UTC"
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return time.Time{}
	}

	timeStr := cfg.AutopilotTime
	if timeStr == "" {
		timeStr = "09:00:00"
	}
	parsed, err := time.Parse("15:04:05", timeStr)
	if err != nil {
		parsed, err = time.Parse("15:04", timeStr)
		if err != nil {
			return time.Time{}
		}
	}

	now := time.Now().In(loc)
	candidate := time.Date(now.Year(), now.Month(), now.Day(), parsed.Hour(), parsed.Minute(), 0, 0, loc)
	if !candidate.After(now) {
		candidate = candidate.AddDate(0, 0, 1)
	}

	// If we ran recently, push the estimate past the due-gap window so the
	// UI doesn't promise a run that the scheduler will skip.
	if lastRunAt != nil && candidate.Sub(*lastRunAt) < 20*time.Hour {
		candidate = candidate.AddDate(0, 0, 1)
	}

	return candidate.UTC()
}
