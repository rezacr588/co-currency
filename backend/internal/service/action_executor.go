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
agentRepo        *repository.AgentPlanRepository
walletService    *WalletService
goalService      *GoalService
budgetService    *BudgetService
recurringService *RecurringService
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

// executeTransfer handles money transfer between wallets
// NOTE: This is a simplified implementation. Production version needs proper transaction handling.
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

// TODO: Implement actual balance checks and transfer logic
// This is a placeholder for the autonomous agent MVP

if dryRun {
return &ExecutionResult{
Success: true,
Message: fmt.Sprintf("Would transfer %.2f from %s to %s", params.Amount, params.FromCurrency, params.ToCurrency),
Impact:  params.Amount,
Details: map[string]interface{}{
"dry_run":       true,
"from_currency": params.FromCurrency,
"to_currency":   params.ToCurrency,
"amount":        params.Amount,
},
}, nil
}

return &ExecutionResult{
Success: true,
Message: fmt.Sprintf("Transfer action logged: %.2f from %s to %s", params.Amount, params.FromCurrency, params.ToCurrency),
Impact:  params.Amount,
Details: map[string]interface{}{
"from_currency": params.FromCurrency,
"to_currency":   params.ToCurrency,
"amount":        params.Amount,
"note":          "Placeholder implementation - actual wallet transfer not executed",
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

// TODO: Implement actual goal contribution logic

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

return &ExecutionResult{
Success: true,
Message: fmt.Sprintf("Goal contribution logged: %.2f %s", params.Amount, params.Currency),
Impact:  params.Amount,
Details: map[string]interface{}{
"goal_id":  params.GoalID.String(),
"amount":   params.Amount,
"currency": params.Currency,
"note":     "Placeholder implementation - actual contribution not executed",
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

// TODO: Implement actual budget adjustment

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

return &ExecutionResult{
Success: true,
Message: fmt.Sprintf("Budget adjustment logged: %.2f", params.NewLimit),
Impact:  params.NewLimit,
Details: map[string]interface{}{
"budget_id": params.BudgetID.String(),
"new_limit": params.NewLimit,
"reason":    params.Reason,
"note":      "Placeholder implementation - actual budget update not executed",
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

// TODO: Implement actual recurring update

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

return &ExecutionResult{
Success: true,
Message: "Recurring update logged",
Impact:  0,
Details: map[string]interface{}{
"recurring_id": params.RecurringID.String(),
"new_amount":   params.NewAmount,
"active":       params.Active,
"note":         "Placeholder implementation - actual update not executed",
},
}, nil
}

// executeSubscriptionCancel handles subscription cancellation
func (e *ActionExecutor) executeSubscriptionCancel(ctx context.Context, userID uuid.UUID, step *model.PlanStep, dryRun bool) (*ExecutionResult, error) {
var params struct {
SubscriptionID uuid.UUID `json:"subscription_id"`
Reason         string    `json:"reason"`
}
if err := parseActionParams(step.ActionParams, &params); err != nil {
return nil, err
}

// TODO: Implement actual subscription cancellation

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

return &ExecutionResult{
Success: true,
Message: "Subscription cancellation logged",
Impact:  0,
Details: map[string]interface{}{
"subscription_id": params.SubscriptionID.String(),
"reason":          params.Reason,
"note":            "Placeholder implementation - actual cancellation not executed",
},
}, nil
}

// executeDebtPayment handles debt payment execution
func (e *ActionExecutor) executeDebtPayment(ctx context.Context, userID uuid.UUID, step *model.PlanStep, dryRun bool) (*ExecutionResult, error) {
var params struct {
LoanID   uuid.UUID `json:"loan_id"`
Amount   float64   `json:"amount"`
Currency string    `json:"currency"`
}
if err := parseActionParams(step.ActionParams, &params); err != nil {
return nil, err
}

// TODO: Implement actual debt payment

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

return &ExecutionResult{
Success: true,
Message: fmt.Sprintf("Debt payment logged: %.2f %s", params.Amount, params.Currency),
Impact:  params.Amount,
Details: map[string]interface{}{
"loan_id":  params.LoanID.String(),
"amount":   params.Amount,
"currency": params.Currency,
"note":     "Placeholder implementation - actual payment not executed",
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
