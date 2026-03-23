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
	"github.com/rs/zerolog/log"
)

// ActionExecutor handles execution of planned actions
type ActionExecutor struct {
	agentRepo           *repository.AgentPlanRepository
	walletService       *WalletService
	goalService         *GoalService
	budgetService       *BudgetService
	recurringService    *RecurringService
	subscriptionService *SubscriptionService
	loanService         *LoanService
}

// NewActionExecutor creates a new action executor
func NewActionExecutor(
	agentRepo *repository.AgentPlanRepository,
	walletService *WalletService,
	goalService *GoalService,
	budgetService *BudgetService,
	recurringService *RecurringService,
) *ActionExecutor {
	return &ActionExecutor{
		agentRepo:        agentRepo,
		walletService:    walletService,
		goalService:      goalService,
		budgetService:    budgetService,
		recurringService: recurringService,
	}
}

// SetSubscriptionService sets the subscription service (for optional dependency injection)
func (e *ActionExecutor) SetSubscriptionService(svc *SubscriptionService) {
	e.subscriptionService = svc
}

// SetLoanService sets the loan service (for optional dependency injection)
func (e *ActionExecutor) SetLoanService(svc *LoanService) {
	e.loanService = svc
}

// ExecutionResult contains the result of an action execution
type ExecutionResult struct {
Success      bool                   `json:"success"`
Message      string                 `json:"message"`
Impact       float64                `json:"impact"`
ErrorMessage string                 `json:"error_message,omitempty"`
Details      map[string]interface{} `json:"details,omitempty"`
}

// ExecuteStep executes a single plan step
func (e *ActionExecutor) ExecuteStep(ctx context.Context, userID, stepID uuid.UUID, dryRun bool) (*ExecutionResult, error) {
// Get the step
step, err := e.agentRepo.GetStepByID(ctx, stepID)
if err != nil {
return nil, fmt.Errorf("failed to get step: %w", err)
}

// Check status - only execute pending steps
if step.Status != "pending" && step.Status != "failed" {
return &ExecutionResult{
Success:      false,
ErrorMessage: fmt.Sprintf("Cannot execute step in status: %s", step.Status),
}, nil
}

// Update status to executing
if !dryRun {
if err := e.agentRepo.UpdateStepStatus(ctx, stepID, "executing", nil); err != nil {
log.Warn().Err(err).Str("step_id", stepID.String()).Msg("Failed to update step status to executing")
}
}

// Execute action based on type
startTime := time.Now()
var result *ExecutionResult

switch step.ActionType {
case "transfer":
result, err = e.executeTransfer(ctx, userID, step, dryRun)
case "goal_contribution":
result, err = e.executeGoalContribution(ctx, userID, step, dryRun)
case "budget_adjustment":
result, err = e.executeBudgetAdjustment(ctx, userID, step, dryRun)
case "recurring_update":
result, err = e.executeRecurringUpdate(ctx, userID, step, dryRun)
case "subscription_cancel":
result, err = e.executeSubscriptionCancel(ctx, userID, step, dryRun)
case "debt_payment":
result, err = e.executeDebtPayment(ctx, userID, step, dryRun)
case "alert":
result, err = e.executeAlert(ctx, userID, step, dryRun)
case "recommendation":
result, err = e.executeRecommendation(ctx, userID, step, dryRun)
default:
return nil, fmt.Errorf("unsupported action type: %s", step.ActionType)
}

executionTimeMs := time.Since(startTime).Milliseconds()

// Update step status based on result
if !dryRun {
if err != nil || !result.Success {
errMsg := ""
if err != nil {
errMsg = err.Error()
} else if result.ErrorMessage != "" {
errMsg = result.ErrorMessage
}
e.agentRepo.UpdateStepStatus(ctx, stepID, "failed", &errMsg)
} else {
e.agentRepo.UpdateStepStatus(ctx, stepID, "completed", nil)
}

// Log the action
executionTimeInt := int(executionTimeMs)
description := ""
if step.Description != nil {
description = *step.Description
}
logEntry := &model.ActionLog{
ID:                uuid.New(),
UserID:            userID,
PlanID:            &step.PlanID,
StepID:            &stepID,
ActionType:        step.ActionType,
ActionDescription: description,
Status:            getResultStatus(result, err),
RequestPayload:    convertToMapInterface(step.ActionParams),
ResponsePayload:   result.Details,
ExecutionTimeMS:   &executionTimeInt,
CreatedAt:         time.Now(),
}
if err := e.agentRepo.CreateLog(ctx, logEntry); err != nil {
log.Warn().Err(err).Msg("Failed to log action execution")
}
}

return result, err
}

// executeTransfer handles currency conversion between wallets
func (e *ActionExecutor) executeTransfer(ctx context.Context, userID uuid.UUID, step *model.PlanStep, dryRun bool) (*ExecutionResult, error) {
	var params struct {
		FromCurrency string  `json:"from_currency"`
		ToCurrency   string  `json:"to_currency"`
		Amount       float64 `json:"amount"`
	}
	if err := parseActionParams(step.ActionParams, &params); err != nil {
		return nil, err
	}

	if e.walletService == nil {
		return &ExecutionResult{Success: false, ErrorMessage: "Wallet service unavailable"}, nil
	}

	if dryRun {
		return &ExecutionResult{
			Success: true,
			Message: fmt.Sprintf("Would convert %.2f from %s to %s", params.Amount, params.FromCurrency, params.ToCurrency),
			Impact:  params.Amount,
			Details: map[string]interface{}{
				"dry_run":       true,
				"from_currency": params.FromCurrency,
				"to_currency":   params.ToCurrency,
				"amount":        params.Amount,
			},
		}, nil
	}

	// Execute the actual conversion
	result, err := e.walletService.ConvertBalance(ctx, userID, &model.ConvertBalanceRequest{
		FromCurrency: params.FromCurrency,
		ToCurrency:   params.ToCurrency,
		Amount:       params.Amount,
	})
	if err != nil {
		return &ExecutionResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Conversion failed: %v", err),
		}, nil
	}

	return &ExecutionResult{
		Success: true,
		Message: fmt.Sprintf("Converted %.2f %s to %.2f %s at rate %.4f", 
			result.FromAmount, result.FromCurrency, result.ToAmount, result.ToCurrency, result.Rate),
		Impact: result.ToAmount,
		Details: map[string]interface{}{
			"from_currency":   result.FromCurrency,
			"to_currency":     result.ToCurrency,
			"from_amount":     result.FromAmount,
			"to_amount":       result.ToAmount,
			"rate":            result.Rate,
			"transaction_id":  result.Transaction.ID.String(),
		},
	}, nil
}

// executeGoalContribution handles contribution to a goal
func (e *ActionExecutor) executeGoalContribution(ctx context.Context, userID uuid.UUID, step *model.PlanStep, dryRun bool) (*ExecutionResult, error) {
	var params struct {
		GoalID   uuid.UUID `json:"goal_id"`
		Amount   float64   `json:"amount"`
		Currency string    `json:"currency"`
	}
	if err := parseActionParams(step.ActionParams, &params); err != nil {
		return nil, err
	}

	if e.goalService == nil {
		return &ExecutionResult{Success: false, ErrorMessage: "Goal service unavailable"}, nil
	}

	if dryRun {
		return &ExecutionResult{
			Success: true,
			Message: fmt.Sprintf("Would contribute %.2f %s to goal", params.Amount, params.Currency),
			Impact:  params.Amount,
			Details: map[string]interface{}{
				"dry_run":  true,
				"goal_id":  params.GoalID.String(),
				"amount":   params.Amount,
				"currency": params.Currency,
			},
		}, nil
	}

	// Execute the actual contribution
	updatedGoal, transaction, err := e.goalService.ContributeToGoal(ctx, userID, params.GoalID, &model.ContributeToGoalRequest{
		Amount: params.Amount,
	})
	if err != nil {
		return &ExecutionResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Contribution failed: %v", err),
		}, nil
	}

	return &ExecutionResult{
		Success: true,
		Message: fmt.Sprintf("Contributed %.2f %s to goal '%s' (now %.2f/%.2f)", 
			params.Amount, updatedGoal.Currency, updatedGoal.Name, updatedGoal.CurrentAmount, updatedGoal.TargetAmount),
		Impact: params.Amount,
		Details: map[string]interface{}{
			"goal_id":        params.GoalID.String(),
			"goal_name":      updatedGoal.Name,
			"amount":         params.Amount,
			"currency":       updatedGoal.Currency,
			"current_amount": updatedGoal.CurrentAmount,
			"target_amount":  updatedGoal.TargetAmount,
			"progress":       (updatedGoal.CurrentAmount / updatedGoal.TargetAmount) * 100,
			"transaction_id": transaction.ID.String(),
		},
	}, nil
}

// executeBudgetAdjustment handles budget threshold adjustments
func (e *ActionExecutor) executeBudgetAdjustment(ctx context.Context, userID uuid.UUID, step *model.PlanStep, dryRun bool) (*ExecutionResult, error) {
	var params struct {
		BudgetID uuid.UUID `json:"budget_id"`
		NewLimit float64   `json:"new_limit"`
		Reason   string    `json:"reason"`
	}
	if err := parseActionParams(step.ActionParams, &params); err != nil {
		return nil, err
	}

	if e.budgetService == nil {
		return &ExecutionResult{Success: false, ErrorMessage: "Budget service unavailable"}, nil
	}

	if dryRun {
		return &ExecutionResult{
			Success: true,
			Message: fmt.Sprintf("Would adjust budget to %.2f", params.NewLimit),
			Impact:  params.NewLimit,
			Details: map[string]interface{}{
				"dry_run":   true,
				"budget_id": params.BudgetID.String(),
				"new_limit": params.NewLimit,
				"reason":    params.Reason,
			},
		}, nil
	}

	// Execute the actual budget update
	updatedBudget, err := e.budgetService.UpdateBudget(ctx, userID, params.BudgetID, &model.UpdateBudgetRequest{
		Amount: &params.NewLimit,
	})
	if err != nil {
		return &ExecutionResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Budget adjustment failed: %v", err),
		}, nil
	}

	return &ExecutionResult{
		Success: true,
		Message: fmt.Sprintf("Adjusted budget '%s' to %.2f %s", updatedBudget.Category, params.NewLimit, updatedBudget.Currency),
		Impact:  params.NewLimit,
		Details: map[string]interface{}{
			"budget_id":   params.BudgetID.String(),
			"category":    updatedBudget.Category,
			"new_limit":   params.NewLimit,
			"currency":    updatedBudget.Currency,
			"period":      updatedBudget.Period,
			"spent":       updatedBudget.Spent,
			"reason":      params.Reason,
		},
	}, nil
}

// executeRecurringUpdate handles recurring transaction updates
func (e *ActionExecutor) executeRecurringUpdate(ctx context.Context, userID uuid.UUID, step *model.PlanStep, dryRun bool) (*ExecutionResult, error) {
	var params struct {
		RecurringID uuid.UUID `json:"recurring_id"`
		NewAmount   *float64  `json:"new_amount,omitempty"`
		Active      *bool     `json:"active,omitempty"`
	}
	if err := parseActionParams(step.ActionParams, &params); err != nil {
		return nil, err
	}

	if e.recurringService == nil {
		return &ExecutionResult{Success: false, ErrorMessage: "Recurring service unavailable"}, nil
	}

	if dryRun {
		return &ExecutionResult{
			Success: true,
			Message: "Would update recurring transaction",
			Impact:  0,
			Details: map[string]interface{}{
				"dry_run":      true,
				"recurring_id": params.RecurringID.String(),
				"new_amount":   params.NewAmount,
				"active":       params.Active,
			},
		}, nil
	}

	// Execute the actual recurring update
	updatedRecurring, err := e.recurringService.UpdateRecurring(ctx, userID, params.RecurringID, &model.UpdateRecurringRequest{
		Amount:   params.NewAmount,
		IsActive: params.Active,
	})
	if err != nil {
		return &ExecutionResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Recurring update failed: %v", err),
		}, nil
	}

	message := fmt.Sprintf("Updated recurring transaction '%s'", updatedRecurring.Description)
	if params.NewAmount != nil {
		message = fmt.Sprintf("Updated recurring '%s' amount to %.2f", updatedRecurring.Description, *params.NewAmount)
	}
	if params.Active != nil && !*params.Active {
		message = fmt.Sprintf("Paused recurring transaction '%s'", updatedRecurring.Description)
	}

	return &ExecutionResult{
		Success: true,
		Message: message,
		Impact:  updatedRecurring.Amount,
		Details: map[string]interface{}{
			"recurring_id": params.RecurringID.String(),
			"description":  updatedRecurring.Description,
			"amount":       updatedRecurring.Amount,
			"frequency":    updatedRecurring.Frequency,
			"is_active":    updatedRecurring.IsActive,
			"currency":     updatedRecurring.Currency,
		},
	}, nil
}

// executeSubscriptionCancel handles subscription cancellation (deletion)
func (e *ActionExecutor) executeSubscriptionCancel(ctx context.Context, userID uuid.UUID, step *model.PlanStep, dryRun bool) (*ExecutionResult, error) {
	var params struct {
		SubscriptionID uuid.UUID `json:"subscription_id"`
		Reason         string    `json:"reason"`
	}
	if err := parseActionParams(step.ActionParams, &params); err != nil {
		return nil, err
	}

	if e.subscriptionService == nil {
		return &ExecutionResult{Success: false, ErrorMessage: "Subscription service unavailable"}, nil
	}

	if dryRun {
		return &ExecutionResult{
			Success: true,
			Message: "Would cancel subscription",
			Impact:  0,
			Details: map[string]interface{}{
				"dry_run":         true,
				"subscription_id": params.SubscriptionID.String(),
				"reason":          params.Reason,
			},
		}, nil
	}

	// Get subscription details before deletion for the response
	subscription, err := e.subscriptionService.GetSubscription(ctx, userID, params.SubscriptionID)
	if err != nil {
		return &ExecutionResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to get subscription: %v", err),
		}, nil
	}

	// Execute the actual subscription deletion
	if err := e.subscriptionService.DeleteSubscription(ctx, userID, params.SubscriptionID); err != nil {
		return &ExecutionResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Subscription cancellation failed: %v", err),
		}, nil
	}

	return &ExecutionResult{
		Success: true,
		Message: fmt.Sprintf("Cancelled subscription '%s' (was %.2f %s/%s)", 
			subscription.Name, subscription.Amount, subscription.Currency, subscription.BillingCycle),
		Impact:  subscription.Amount,
		Details: map[string]interface{}{
			"subscription_id": params.SubscriptionID.String(),
			"name":            subscription.Name,
			"amount":          subscription.Amount,
			"currency":        subscription.Currency,
			"billing_cycle":   subscription.BillingCycle,
			"reason":          params.Reason,
		},
	}, nil
}

// executeDebtPayment handles debt/loan payment execution
func (e *ActionExecutor) executeDebtPayment(ctx context.Context, userID uuid.UUID, step *model.PlanStep, dryRun bool) (*ExecutionResult, error) {
	var params struct {
		LoanID   uuid.UUID `json:"loan_id"`
		Amount   float64   `json:"amount"`
		Currency string    `json:"currency"`
	}
	if err := parseActionParams(step.ActionParams, &params); err != nil {
		return nil, err
	}

	if e.loanService == nil {
		return &ExecutionResult{Success: false, ErrorMessage: "Loan service unavailable"}, nil
	}

	if dryRun {
		return &ExecutionResult{
			Success: true,
			Message: fmt.Sprintf("Would make payment of %.2f %s", params.Amount, params.Currency),
			Impact:  params.Amount,
			Details: map[string]interface{}{
				"dry_run":  true,
				"loan_id":  params.LoanID.String(),
				"amount":   params.Amount,
				"currency": params.Currency,
			},
		}, nil
	}

	// Execute the actual loan payment
	payment, err := e.loanService.MakePayment(ctx, params.LoanID.String(), userID.String(), model.CreatePaymentRequest{
		Amount:      params.Amount,
		PaymentType: model.PaymentTypePayment,
		Notes:       "Automated payment via agent",
	})
	if err != nil {
		return &ExecutionResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Debt payment failed: %v", err),
		}, nil
	}

	return &ExecutionResult{
		Success: true,
		Message: fmt.Sprintf("Made loan payment of %.2f", params.Amount),
		Impact:  params.Amount,
		Details: map[string]interface{}{
			"loan_id":    params.LoanID.String(),
			"payment_id": payment.ID,
			"amount":     payment.Amount,
			"created_at": payment.CreatedAt,
		},
	}, nil
}

// executeAlert sends an alert/notification
func (e *ActionExecutor) executeAlert(ctx context.Context, userID uuid.UUID, step *model.PlanStep, dryRun bool) (*ExecutionResult, error) {
var params struct {
Title    string `json:"title"`
Message  string `json:"message"`
Priority string `json:"priority"`
}
if err := parseActionParams(step.ActionParams, &params); err != nil {
return nil, err
}

// TODO: Integrate with notification system

if dryRun {
return &ExecutionResult{
Success: true,
Message: "Would send alert: " + params.Title,
Impact:  0,
Details: map[string]interface{}{
"dry_run":  true,
"title":    params.Title,
"message":  params.Message,
"priority": params.Priority,
},
}, nil
}

return &ExecutionResult{
Success: true,
Message: "Alert logged: " + params.Title,
Impact:  0,
Details: map[string]interface{}{
"title":    params.Title,
"message":  params.Message,
"priority": params.Priority,
"note":     "Placeholder implementation - actual notification not sent",
},
}, nil
}

// executeRecommendation logs a financial recommendation
func (e *ActionExecutor) executeRecommendation(ctx context.Context, userID uuid.UUID, step *model.PlanStep, dryRun bool) (*ExecutionResult, error) {
var params struct {
Type        string  `json:"type"`
Description string  `json:"description"`
Impact      float64 `json:"impact"`
}
if err := parseActionParams(step.ActionParams, &params); err != nil {
return nil, err
}

// Recommendations are always "executed" as they're informational
return &ExecutionResult{
Success: true,
Message: "Recommendation: " + params.Description,
Impact:  params.Impact,
Details: map[string]interface{}{
"type":        params.Type,
"description": params.Description,
"impact":      params.Impact,
},
}, nil
}

// Helper functions

func parseActionParams(params map[string]interface{}, target interface{}) error {
if params == nil {
return errors.New("action_params is required")
}
// Convert map to JSON then unmarshal to target type
jsonBytes, err := json.Marshal(params)
if err != nil {
return fmt.Errorf("failed to marshal params: %w", err)
}
return json.Unmarshal(jsonBytes, target)
}

func convertToMapInterface(m map[string]interface{}) map[string]interface{} {
return m
}

func getResultStatus(result *ExecutionResult, err error) string {
if err != nil {
return "failed"
}
if result.Success {
return "completed"
}
return "failed"
}
